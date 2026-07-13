import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/profile';

type ProfileState = {
  profile: Profile | null;
  // True while the initial profile fetch for the current user is in flight.
  loading: boolean;
  // True once we've resolved the profile for the current user (success or not).
  // The navigation gate waits for this so it never redirects on stale data.
  loaded: boolean;

  fetchProfile: (userId: string) => Promise<void>;
  clearProfile: () => void;
  isUsernameAvailable: (username: string) => Promise<boolean>;
  setUsername: (userId: string, username: string) => Promise<void>;
};

// Postgres unique-violation error code (raised if two users race for a name).
const UNIQUE_VIOLATION = '23505';

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loading: false,
  loaded: false,

  fetchProfile: async (userId) => {
    set({ loading: true });

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Surface nothing to the UI here; the gate treats "no username" as
      // needing onboarding, and a transient read error shouldn't lock the app.
      console.warn('Failed to load profile', error.message);
      set({ profile: null, loading: false, loaded: true });
      return;
    }

    set({ profile: data as Profile | null, loading: false, loaded: true });
  },

  clearProfile: () => {
    set({ profile: null, loading: false, loaded: false });
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

    set({ profile: data as Profile, loaded: true });
  },
}));
