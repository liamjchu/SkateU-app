const mockCreateURL = jest.fn((_path: string) => 'skateu://auth/callback');
const mockOpenAuthSessionAsync = jest.fn();
const mockDismissBrowser = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockSetSession = jest.fn();

jest.mock('expo-linking', () => ({
  createURL: (path: string) => mockCreateURL(path) as string,
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (url: string, redirectTo: string) =>
    mockOpenAuthSessionAsync(url, redirectTo),
  dismissBrowser: () => mockDismissBrowser(),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (params: unknown) => mockSignInWithOAuth(params),
      exchangeCodeForSession: (code: string) => mockExchangeCodeForSession(code),
      setSession: (session: unknown) => mockSetSession(session),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
    },
  },
}));

import { useAuthStore } from '../authStore';

beforeEach(() => {
  mockCreateURL.mockClear();
  mockOpenAuthSessionAsync.mockReset();
  mockDismissBrowser.mockReset();
  mockSignInWithOAuth.mockReset();
  mockExchangeCodeForSession.mockReset();
  mockSetSession.mockReset();
  mockCreateURL.mockReturnValue('skateu://auth/callback');
  mockDismissBrowser.mockReturnValue(undefined);
  useAuthStore.setState({ session: null, user: null });
});

describe('signInWithGoogle', () => {
  it('opens Google OAuth and exchanges the returned code for a session', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/auth' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'skateu://auth/callback?code=google-auth-code-1',
    });
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    await expect(useAuthStore.getState().signInWithGoogle()).resolves.toBe(true);

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'skateu://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/auth',
      'skateu://auth/callback'
    );
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('google-auth-code-1');
    // dismissBrowser is for openBrowserAsync only. Calling it after an
    // auth session throws "There is no web browser to dismiss" on iOS.
    expect(mockDismissBrowser).not.toHaveBeenCalled();
  });

  it('returns false when the Google sheet is dismissed', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/auth' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({ type: 'cancel' });

    await expect(useAuthStore.getState().signInWithGoogle()).resolves.toBe(false);
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('returns true when a session was already established after the sheet closed', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/auth' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockImplementation(async () => {
      useAuthStore.setState({
        session: { access_token: 'token' } as never,
        user: { id: 'user-1' } as never,
      });
      return { type: 'cancel' };
    });

    await expect(useAuthStore.getState().signInWithGoogle()).resolves.toBe(true);
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('throws when Google OAuth cannot start', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: null,
    });

    await expect(useAuthStore.getState().signInWithGoogle()).rejects.toThrow(
      'Could not start Google sign-in. Please try again.'
    );
  });
});
