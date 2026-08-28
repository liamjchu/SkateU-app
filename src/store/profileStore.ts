import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getApiUrl } from '../lib/api';
import { getClientStorage } from '../lib/clientStorage';
import {
  PROFILE_PUBLIC_SELECT_COLUMNS,
  PROFILE_PUBLIC_SELECT_COLUMNS_WITHOUT_BIO,
} from '../lib/legalAcceptance';
import {
  parseProfile,
  PROFILE_CACHE_KEY,
  readPersistedRecord,
} from '../lib/readCache';
import { supabase } from '../lib/supabase';
import { sanitizeErrorMessage } from '../lib/userFacingError';
import { mapProfile, type Profile } from '../types/profile';
import type { SpotImageAsset } from '../types/spot';
import { useCommentsStore } from './commentsStore';
import { useSpotsStore } from './spotsStore';

export type UsernameClaimResult =
  | { ok: true }
  | { ok: false; taken: boolean; message: string };

export type AvatarUpdateResult =
  | { ok: true }
  | { ok: false; message: string };

export type BioUpdateResult =
  | { ok: true }
  | { ok: false; message: string };

type UsernameClaimResponse = {
  allowed?: boolean;
  taken?: boolean;
  reason?: string;
  error?: string;
  profile?: Profile;
};

type ProfileState = {
  profile: Profile | null;
  // The user who just completed onboarding in this app session.
  welcomeAboardUserId: string | null;
  // True while the initial profile fetch for the current user is in flight.
  loading: boolean;
  // True once we've resolved the profile for the current user successfully
  // (including a valid missing row). Fetch errors leave this false.
  loaded: boolean;
  // A transient fetch failure is distinct from a valid missing profile.
  error: string | null;
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;

  fetchProfile: (userId: string, accessToken?: string | null) => Promise<void>;
  clearProfile: () => void;
  isUsernameAvailable: (
    username: string,
    excludingUserId?: string
  ) => Promise<boolean>;
  claimUsername: (
    accessToken: string,
    username: string,
    showWelcomeOnSave?: boolean
  ) => Promise<UsernameClaimResult>;
  updateAvatar: (
    accessToken: string,
    asset: SpotImageAsset
  ) => Promise<AvatarUpdateResult>;
  removeAvatar: (accessToken: string) => Promise<void>;
  updateBio: (accessToken: string, bio: string) => Promise<BioUpdateResult>;
  acceptLegal: (accessToken: string) => Promise<void>;
};

const USERNAME_MODERATION_TIMEOUT_MS = 10_000;
const AVATAR_UPDATE_TIMEOUT_MS = 60_000;

let profileRequestVersion = 0;

const PROFILE_LOAD_FAILED =
  'We couldn’t load your profile right now. Please try again.';

function mergeReturnedProfile(current: Profile | null, next: Profile): Profile {
  const profile = mapProfile(next);
  return {
    ...profile,
    legal_version: profile.legal_version ?? current?.legal_version ?? null,
    legal_accepted_at:
      profile.legal_accepted_at ?? current?.legal_accepted_at ?? null,
    age_attested_at:
      profile.age_attested_at ?? current?.age_attested_at ?? null,
  };
}

function syncAvatarCaches(profile: Profile): void {
  useSpotsStore.getState().replaceCreatorAvatar(profile.id, profile.avatar_url);
  useCommentsStore.getState().replaceCreatorAvatar(profile.id, profile.avatar_url);
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
  profile: null,
  welcomeAboardUserId: null,
  loading: false,
  loaded: false,
  error: null,
  hasHydrated: false,
  setHasHydrated: (hasHydrated) => set({ hasHydrated }),

  fetchProfile: async (userId, accessToken) => {
    const requestVersion = ++profileRequestVersion;
    const cached = get().profile?.id === userId ? get().profile : null;
    set({
      profile: cached,
      loading: cached === null,
      loaded: cached !== null,
      error: null,
    });

    let { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_PUBLIC_SELECT_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error?.message?.includes('profiles.bio does not exist')) {
      const fallback = await supabase
        .from('profiles')
        .select(PROFILE_PUBLIC_SELECT_COLUMNS_WITHOUT_BIO)
        .eq('id', userId)
        .maybeSingle();
      data = fallback.data ? { ...fallback.data, bio: null } : null;
      error = fallback.error;
    }

    if (requestVersion !== profileRequestVersion) {
      return;
    }

    if (error) {
      console.warn('Failed to load profile', error.message);
      set({
        profile: cached,
        loading: false,
        loaded: cached !== null,
        error: PROFILE_LOAD_FAILED,
      });
      return;
    }

    const publicProfile = data
      ? mapProfile({
          ...data,
          legal_version: null,
          legal_accepted_at: null,
          age_attested_at: null,
        })
      : null;

    if (!publicProfile || !accessToken) {
      set({
        profile: publicProfile,
        loading: false,
        loaded: true,
        error: null,
      });
      return;
    }

    try {
      const legalResponse = await fetch(getApiUrl('/api/accept-legal'), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (requestVersion !== profileRequestVersion) {
        return;
      }

      const legalData = (await legalResponse.json().catch(() => null)) as
        | { profile?: Profile; error?: string }
        | null;

      if (!legalResponse.ok || !legalData?.profile?.id) {
        throw new Error(legalData?.error ?? 'Could not load legal acceptance.');
      }

      set({
        profile: mapProfile(legalData.profile),
        loading: false,
        loaded: true,
        error: null,
      });
    } catch (legalError) {
      if (requestVersion !== profileRequestVersion) {
        return;
      }

      console.warn('Failed to load legal acceptance', legalError);
      set({
        profile: publicProfile,
        loading: false,
        loaded: true,
        error: null,
      });
    }
  },

  clearProfile: () => {
    profileRequestVersion += 1;
    set({
      profile: null,
      welcomeAboardUserId: null,
      loading: false,
      loaded: false,
      error: null,
    });
  },

  // This only provides typing feedback. The server-side claim remains the
  // source of truth so concurrent requests cannot reserve the same username.
  isUsernameAvailable: async (username, excludingUserId) => {
    const query = supabase
      .from('profiles')
      .select('id')
      .ilike('username', username);
    const { data, error } = excludingUserId
      ? await query.neq('id', excludingUserId).maybeSingle()
      : await query.maybeSingle();

    if (error) {
      throw error;
    }

    return data === null;
  },

  claimUsername: async (accessToken, username, showWelcomeOnSave = false) => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      USERNAME_MODERATION_TIMEOUT_MS
    );

    try {
      const response = await fetch(getApiUrl('/api/moderate-username'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as
        | UsernameClaimResponse
        | null;

      if (!response.ok) {
        throw new Error(
          sanitizeErrorMessage(
            data?.error ?? '',
            'Could not save the username right now. Try again.'
          )
        );
      }

      if (!data?.allowed) {
        return {
          ok: false,
          taken: data?.taken === true,
          message: data?.reason ?? 'Let’s try a different username.',
        };
      }

      if (!data.profile?.id || data.profile.username !== username) {
        throw new Error('Could not save the username right now. Try again.');
      }

      const profile = mapProfile(data.profile);
      const current = get().profile;
      const previousUsername = current?.username;
      const welcomeAboardUserId = get().welcomeAboardUserId;
      profileRequestVersion += 1;
      set({
        profile: {
          ...profile,
          legal_version: profile.legal_version ?? current?.legal_version ?? null,
          legal_accepted_at:
            profile.legal_accepted_at ?? current?.legal_accepted_at ?? null,
          age_attested_at:
            profile.age_attested_at ?? current?.age_attested_at ?? null,
        },
        welcomeAboardUserId: showWelcomeOnSave ? profile.id : welcomeAboardUserId,
        loading: false,
        loaded: true,
        error: null,
      });

      if (previousUsername && previousUsername !== username) {
        useSpotsStore
          .getState()
          .replaceCreatorUsername(previousUsername, username);
      }

      return { ok: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Saving the username timed out. Please try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },

  updateAvatar: async (accessToken, asset) => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      AVATAR_UPDATE_TIMEOUT_MS
    );

    try {
      const form = new FormData();
      form.append(
        'image',
        {
          uri: asset.uri,
          name: asset.fileName ?? 'avatar.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        } as unknown as Blob
      );

      const response = await fetch(getApiUrl('/api/profile-avatar'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as
        | { allowed?: boolean; reason?: string; error?: string; profile?: Profile }
        | null;

      if (!response.ok) {
        throw new Error(
          sanitizeErrorMessage(
            data?.error ?? '',
            'Could not save the photo right now. Try again.'
          )
        );
      }

      if (data?.allowed === false) {
        return {
          ok: false,
          message: data.reason ?? 'Let’s try a different photo.',
        };
      }

      if (!data?.profile?.id) {
        throw new Error('Could not save the photo right now. Try again.');
      }

      const profile = mergeReturnedProfile(get().profile, data.profile);
      profileRequestVersion += 1;
      set({
        profile,
        loading: false,
        loaded: true,
        error: null,
      });
      syncAvatarCaches(profile);
      return { ok: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Saving the photo timed out. Please try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },

  removeAvatar: async (accessToken) => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      AVATAR_UPDATE_TIMEOUT_MS
    );

    try {
      const response = await fetch(getApiUrl('/api/profile-avatar'), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; profile?: Profile }
        | null;

      if (!response.ok) {
        throw new Error(
          sanitizeErrorMessage(
            data?.error ?? '',
            'Could not remove the photo right now. Try again.'
          )
        );
      }

      if (!data?.profile?.id) {
        throw new Error('Could not remove the photo right now. Try again.');
      }

      const profile = mergeReturnedProfile(get().profile, data.profile);
      profileRequestVersion += 1;
      set({
        profile,
        loading: false,
        loaded: true,
        error: null,
      });
      syncAvatarCaches(profile);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Removing the photo timed out. Please try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },

  updateBio: async (accessToken, bio) => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      USERNAME_MODERATION_TIMEOUT_MS
    );

    try {
      const response = await fetch(getApiUrl('/api/profile-bio'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bio }),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as
        | { allowed?: boolean; reason?: string; error?: string; profile?: Profile }
        | null;

      if (!response.ok) {
        throw new Error(
          sanitizeErrorMessage(
            data?.error ?? '',
            'Could not save the bio right now. Try again.'
          )
        );
      }

      if (data?.allowed === false) {
        return {
          ok: false,
          message: data.reason ?? 'Let’s try a different bio.',
        };
      }

      if (!data?.profile?.id) {
        throw new Error('Could not save the bio right now. Try again.');
      }

      const profile = mergeReturnedProfile(get().profile, data.profile);
      profileRequestVersion += 1;
      set({
        profile,
        loading: false,
        loaded: true,
        error: null,
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Saving the bio timed out. Please try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },

  acceptLegal: async (accessToken) => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      USERNAME_MODERATION_TIMEOUT_MS
    );

    try {
      const response = await fetch(getApiUrl('/api/accept-legal'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as
        | { profile?: Profile; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          sanitizeErrorMessage(
            data?.error ?? '',
            'Could not save your agreement right now. Try again.'
          )
        );
      }

      if (!data?.profile?.id) {
        throw new Error('Could not save your agreement right now. Try again.');
      }

      profileRequestVersion += 1;
      set({
        profile: mapProfile(data.profile),
        loading: false,
        loaded: true,
        error: null,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Saving your agreement timed out. Please try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },
    }),
    {
      name: PROFILE_CACHE_KEY,
      storage: createJSONStorage(getClientStorage),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useProfileStore.getState().setHasHydrated(true);
      },
      partialize: (state) => ({
        profile: state.profile,
      }),
      merge: (persistedState, currentState) => {
        const persisted = readPersistedRecord(persistedState);
        const profile = parseProfile(persisted.profile);
        return {
          ...currentState,
          profile,
          loaded: profile !== null,
        };
      },
    }
  )
);
