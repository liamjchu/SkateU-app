import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
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
  // Resolves true when a session was established, false when the user
  // cancelled/dismissed the OAuth sheet.
  signInWithGoogle: () => Promise<boolean>;
  setSessionFromUrl: (url: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

// Reads every param off the redirect URL, whether Supabase put them in the
// "?" query string (PKCE: ?code=...) or the "#" fragment (implicit:
// #access_token=...&refresh_token=...&error=...).
const parseAuthParams = (url: string): Record<string, string> => {
  const params: Record<string, string> = {};

  const collect = (raw?: string) => {
    if (!raw) {
      return;
    }
    new URLSearchParams(raw).forEach((value, key) => {
      params[key] = value;
    });
  };

  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  if (queryIndex !== -1) {
    const end = hashIndex > queryIndex ? hashIndex : url.length;
    collect(url.slice(queryIndex + 1, end));
  }
  if (hashIndex !== -1) {
    collect(url.slice(hashIndex + 1));
  }

  return params;
};

// A redirect URL's code/tokens are single-use. Both the in-app browser result
// and the global deep-link listener may hand us the same URL, so we remember
// what we've already processed and skip duplicates (a reused code errors out).
const handledKeys = new Set<string>();

// Holds the active auth-state listener so repeated init() calls don't stack up
// multiple subscriptions (which would fire the setter several times per event).
let authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
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

    // Drop any previous listener before subscribing again so we only ever keep
    // one active subscription.
    authSubscription?.unsubscribe();

    // Keep the store in sync with sign in, sign out, and token refreshes.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
    authSubscription = data.subscription;
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

  signInWithGoogle: async () => {
    // Build a redirect URL that adapts to the runtime automatically:
    // - Expo Go:     exp://127.0.0.1:8081/--/auth/callback
    // - Production:  skateu://auth/callback
    const redirectTo = Linking.createURL('auth/callback');

    // Ask Supabase for the Google consent URL. skipBrowserRedirect keeps
    // control on our side so we can open it inside the app rather than
    // bouncing through the system browser.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      throw error;
    }

    if (!data?.url) {
      throw new Error('Could not start Google sign in. Try again.');
    }

    // Open the Google login in an in-app browser sheet. It resolves once the
    // browser navigates to our redirectTo URL (which carries the auth code).
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    // Make sure the sheet is gone. In Expo Go the deep link can reopen the app
    // without auto-dismissing the browser, which looks like an endless spinner.
    try {
      WebBrowser.dismissBrowser();
    } catch {
      // No browser open to dismiss; ignore.
    }

    if (result.type !== 'success' || !result.url) {
      // User dismissed the sheet or cancelled; nothing to do.
      return false;
    }

    // Hand the returned URL to Supabase to establish the session. The global
    // deep-link listener may also fire for the same URL; handledKeys dedupes it.
    return await get().setSessionFromUrl(result.url);
  },

  setSessionFromUrl: async (url) => {
    const params = parseAuthParams(url);

    // Google/Supabase can report failures on the redirect URL itself.
    if (params.error || params.error_description) {
      throw new Error(
        params.error_description || params.error || 'Google sign in failed.'
      );
    }

    const key = params.code ?? params.access_token;

    if (!key) {
      // Not an auth redirect (or missing data); nothing to do.
      return false;
    }

    // Skip if we've already consumed this code/token (see handledKeys above).
    if (handledKeys.has(key)) {
      return true;
    }
    handledKeys.add(key);

    if (params.code) {
      // PKCE flow: swap the one-time code for a session. Supabase reads the
      // matching code_verifier it stashed in AsyncStorage during signInWithOAuth,
      // so this still works even if the app reloaded on the deep link.
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (error) {
        handledKeys.delete(key);
        throw error;
      }
    } else {
      // Implicit flow fallback: tokens arrive directly in the URL.
      const { error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (error) {
        handledKeys.delete(key);
        throw error;
      }
    }

    // Either path fires onAuthStateChange, which updates session/user here.
    return true;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },
}));
