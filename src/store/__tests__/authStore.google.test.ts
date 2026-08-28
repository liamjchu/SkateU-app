const mockCreateURL = jest.fn((_path: string) => 'skateu://auth/callback');
const mockOpenAuthSessionAsync = jest.fn();
const mockDismissBrowser = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockSetSession = jest.fn();
const mockGetSession = jest.fn();

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
      getSession: () => mockGetSession(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
    },
  },
}));

import { useAuthStore } from '../authStore';

const mockAuthSession = {
  access_token: 'token',
  user: { id: 'user-1', created_at: '2024-01-01T00:00:00.000Z' },
};

beforeEach(() => {
  mockCreateURL.mockClear();
  mockOpenAuthSessionAsync.mockReset();
  mockDismissBrowser.mockReset();
  mockSignInWithOAuth.mockReset();
  mockExchangeCodeForSession.mockReset();
  mockSetSession.mockReset();
  mockGetSession.mockReset();
  mockCreateURL.mockReturnValue('skateu://auth/callback');
  mockDismissBrowser.mockReturnValue(undefined);
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
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
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: mockAuthSession },
      error: null,
    });

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
      'Could not start Google log-in. Please try again.'
    );
  });

  it('throws when Google OAuth returns an error', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/auth' },
      error: new Error('oauth down'),
    });
    await expect(useAuthStore.getState().signInWithGoogle()).rejects.toThrow(
      'oauth down'
    );
  });
});

describe('setSessionFromUrl', () => {
  it('shares one in-flight exchange and waits for a real session', async () => {
    let resolveExchange: (value: {
      data: { session: typeof mockAuthSession };
      error: null;
    }) => void = () => undefined;
    mockExchangeCodeForSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExchange = resolve;
        })
    );

    const url = 'skateu://auth/callback?code=concurrent-google-code';
    const first = useAuthStore.getState().setSessionFromUrl(url);
    const second = useAuthStore.getState().setSessionFromUrl(url);

    await Promise.resolve();
    expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().session).toBeNull();

    resolveExchange({ data: { session: mockAuthSession }, error: null });

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(useAuthStore.getState().user?.id).toBe('user-1');
  });

  it('does not report success when the code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: new Error('Network request failed'),
    });

    await expect(
      useAuthStore
        .getState()
        .setSessionFromUrl('skateu://auth/callback?code=failed-google-code')
    ).rejects.toThrow('Network request failed');
    expect(useAuthStore.getState().session).toBeNull();

    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: mockAuthSession },
      error: null,
    });

    await expect(
      useAuthStore
        .getState()
        .setSessionFromUrl('skateu://auth/callback?code=failed-google-code')
    ).resolves.toBe(true);
    expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(2);
  });
});
