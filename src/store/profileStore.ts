import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/profile';

type ProfileState = {
  profile: Profile | null;
  // True while the initial profile fetch for the current user is in flight.
  loading: boolean;
  // True once we've resolved the profile for the current user successfully
  // (including a valid missing row). Fetch errors leave this false.
  loaded: boolean;
  // A transient fetch failure is distinct from a valid missing profile.
  error: string | null;

  fetchProfile: (userId: string) => Promise<void>;
  clearProfile: () => void;
  isUsernameAvailable: (username: string) => Promise<boolean>;
  setUsername: (userId: string, username: string) => Promise<void>;
};

// Postgres unique-violation error code (raised if two users race for a name).
const UNIQUE_VIOLATION = '23505';
let profileRequestVersion = 0;

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
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
    set({ profile: null, loading: false, loaded: false, error: null });
  },

  // Case-insensitive availability check. The DB has the final say via its
  // unique index, but this gives the user instant feedback while typing.
  isUsernameAvailable: async (username) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data === null;
  },

  setUsername: async (userId, username) => {
    const requestVersion = ++profileRequestVersion;
    const { data, error } = await supabase
      .from('profiles')
      .update({ username, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, username, avatar_url, updated_at')
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new Error('That username is already taken.');
      }
      throw error;
    }

    if (requestVersion !== profileRequestVersion) {
      return;
    }

    set({ profile: data as Profile, loaded: true, error: null });
  },
}));
