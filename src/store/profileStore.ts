import { create } from 'zustand';
import { getApiUrl } from '../lib/api';
import { PROFILE_PUBLIC_SELECT_COLUMNS } from '../lib/legalAcceptance';
import { supabase } from '../lib/supabase';
import { sanitizeErrorMessage } from '../lib/userFacingError';
import { mapProfile, type Profile } from '../types/profile';
import { useSpotsStore } from './spotsStore';

export type UsernameClaimResult =
  | { ok: true }
  | { ok: false; taken: boolean; message: string };

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
  acceptLegal: (accessToken: string) => Promise<void>;
};

const USERNAME_MODERATION_TIMEOUT_MS = 10_000;

let profileRequestVersion = 0;

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  welcomeAboardUserId: null,
  loading: false,
  loaded: false,
  error: null,

  fetchProfile: async (userId, accessToken) => {
    const requestVersion = ++profileRequestVersion;
    set({ profile: null, loading: true, loaded: false, error: null });

    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_PUBLIC_SELECT_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (requestVersion !== profileRequestVersion) {
      return;
    }

    if (error) {
      console.warn('Failed to load profile', error.message);
      set({
        profile: null,
        loading: false,
        loaded: false,
        error: 'We couldn’t load your profile right now. Please try again.',
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
        profile: null,
        loading: false,
        loaded: false,
        error: 'We couldn’t load your profile right now. Please try again.',
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
}));
