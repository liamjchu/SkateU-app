import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { create } from 'zustand';
import { getApiUrl } from '../lib/api';
import { supabase } from '../lib/supabase';

type AuthState = {
  session: Session | null;
  user: User | null;
  // True until the persisted session has been restored on app start.
  initializing: boolean;
  passwordRecovery: boolean;
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
  // Clears the recovery-only state after the password has been updated.
  completePasswordRecovery: () => void;
  signOut: () => Promise<void>;
  // Emails a fresh 6-digit code to re-verify identity before a destructive
  // action (account deletion). Reuses Supabase's email OTP, not a separate
  // "delete" flow type.
  sendDeleteAccountOtp: (email: string) => Promise<void>;
  verifyDeleteAccountOtp: (email: string, token: string) => Promise<void>;
  // Permanently deletes the signed-in user's account. Call only after
  // verifyDeleteAccountOtp has succeeded.
  deleteAccount: () => Promise<void>;
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

const DELETE_ACCOUNT_TIMEOUT_MS = 10_000;
let deleteAccountProof: string | null = null;

async function fetchDeleteAccountApi(
  path: string,
  accessToken: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELETE_ACCOUNT_TIMEOUT_MS);

  try {
    return await fetch(getApiUrl(path), {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Account deletion timed out. Enter a new code and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function createDeleteAccountProof(accessToken: string): Promise<string> {
  const response = await fetchDeleteAccountApi('/api/delete-account-proof', accessToken, {
    method: 'POST',
  });
  const data = (await response.json().catch(() => null)) as
    | { proof?: string; error?: string }
    | null;

  if (!response.ok || !data?.proof) {
    throw new Error(
      data?.error ?? 'Could not verify account deletion right now. Please try again.'
    );
  }

  return data.proof;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  initializing: true,
  passwordRecovery: false,

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

    // Keep the store in sync with log in, sign out, and token refreshes.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        deleteAccountProof = null;
      }

      set((state) => ({
        session,
        user: session?.user ?? null,
        passwordRecovery:
          event === 'PASSWORD_RECOVERY'
            ? true
            : event === 'SIGNED_OUT'
              ? false
              : state.passwordRecovery,
      }));
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
      throw new Error('Could not start Google log in. Try again.');
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
        params.error_description || params.error || 'Google log in failed.'
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

  completePasswordRecovery: () => {
    set({ passwordRecovery: false });
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    deleteAccountProof = null;
    set({ passwordRecovery: false });
  },

  // Sends a 6-digit email OTP to the already-registered user. Unlike signUp's
  // confirmation email, `shouldCreateUser: false` guarantees this never creates
  // a new account — it only works for an existing address, which re-verifies
  // that whoever is tapping "Delete account" controls that inbox.
  sendDeleteAccountOtp: async (email) => {
    deleteAccountProof = null;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

    if (error) {
      throw error;
    }
  },

  verifyDeleteAccountOtp: async (email, token) => {
    deleteAccountProof = null;
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'email',
    });

    if (error) {
      throw error;
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) {
      throw new Error('Could not verify account deletion. Please try again.');
    }

    deleteAccountProof = await createDeleteAccountProof(accessToken);
  },

  deleteAccount: async () => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    const proof = deleteAccountProof;

    if (!accessToken) {
      throw new Error('You must be signed in to delete your account.');
    }
    if (!proof) {
      throw new Error('Enter a new email verification code to delete your account.');
    }

    // Do not retry with the same credential locally: the server consumes it
    // atomically before it attempts the permanent deletion.
    deleteAccountProof = null;
    const response = await fetchDeleteAccountApi('/api/delete-account', accessToken, {
      method: 'DELETE',
      headers: { 'X-Delete-Account-Proof': proof },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(
        body?.error ?? 'Could not delete your account right now. Try again.'
      );
    }

    // The server has deleted the auth user; drop the local session too.
    await supabase.auth.signOut();
    set({ passwordRecovery: false });
  },
}));
