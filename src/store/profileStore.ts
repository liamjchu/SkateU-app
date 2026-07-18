import { create } from 'zustand';
import { getApiUrl } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/profile';
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

  fetchProfile: (userId: string) => Promise<void>;
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
};

let profileRequestVersion = 0;

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  welcomeAboardUserId: null,
  loading: false,
  loaded: false,
  error: null,

  fetchProfile: async (userId) => {
    const requestVersion = ++profileRequestVersion;
    set({ profile: null, loading: true, loaded: false, error: null });

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, updated_at')
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
        error: 'Unable to load your profile right now. Please try again.',
      });
      return;
    }

    set({
      profile: data as Profile | null,
      loading: false,
      loaded: true,
      error: null,
    });
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
    const query = supabase.from('profiles').select('id').eq('username', username);
    const { data, error } = excludingUserId
      ? await query.neq('id', excludingUserId).maybeSingle()
      : await query.maybeSingle();

    if (error) {
      throw error;
    }

    return data === null;
  },

  claimUsername: async (accessToken, username, showWelcomeOnSave = false) => {
    const response = await fetch(getApiUrl('/api/moderate-username'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });

    const data = (await response.json().catch(() => null)) as
      | UsernameClaimResponse
      | null;

    if (!response.ok) {
      throw new Error(
        data?.error ?? 'Could not save the username right now. Try again.'
      );
    }

    if (!data?.allowed) {
      return {
        ok: false,
        taken: data?.taken === true,
        message: data?.reason ?? "That username isn't allowed. Please pick another.",
      };
    }

    const profile = data.profile;
    if (!profile?.id || profile.username !== username) {
      throw new Error('Could not save the username right now. Try again.');
    }

    const previousUsername = get().profile?.username;
    const welcomeAboardUserId = get().welcomeAboardUserId;
    profileRequestVersion += 1;
    set({
      profile,
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
  },
}));
