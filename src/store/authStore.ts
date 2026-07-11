import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

type AuthState = {
  session: Session | null;
  user: User | null;
  // True until the persisted session has been restored on app start.
  initializing: boolean;
  init: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  resendSignUpOtp: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  initializing: true,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({
        session: data.session,
        user: data.session?.user ?? null,
        initializing: false,
      });
    });

    // Keep the store in sync with sign in, sign out, and token refreshes.
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw error;
    }
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      throw error;
    }

    // When email confirmation is on, Supabase returns a user but no session
    // until the address is confirmed with the emailed 6-digit code.
    return { needsEmailConfirmation: !data.session };
  },

  verifyOtp: async (email, token) => {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'signup',
    });

    if (error) {
      throw error;
    }
  },

  resendSignUpOtp: async (email) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });

    if (error) {
      throw error;
    }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },
}));
