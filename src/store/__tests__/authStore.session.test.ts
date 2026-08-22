const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockVerifyOtp = jest.fn();
const mockResend = jest.fn();
const mockSignOut = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockSetSession = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockClearUserDrafts = jest.fn();
const mockAgeClear = jest.fn();

jest.mock('expo-linking', () => ({
  createURL: () => 'skateu://auth/callback',
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  dismissBrowser: jest.fn(),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (handler: unknown) => mockOnAuthStateChange(handler),
      signInWithPassword: (params: unknown) => mockSignInWithPassword(params),
      verifyOtp: (params: unknown) => mockVerifyOtp(params),
      resend: (params: unknown) => mockResend(params),
      signOut: () => mockSignOut(),
      signInWithOtp: (params: unknown) => mockSignInWithOtp(params),
      setSession: (session: unknown) => mockSetSession(session),
      exchangeCodeForSession: (code: string) => mockExchangeCodeForSession(code),
      signUp: jest.fn(),
      signInWithOAuth: jest.fn(),
    },
  },
}));

jest.mock('../ageEligibilityStore', () => ({
  useAgeEligibilityStore: {
    getState: () => ({
      confirmedThisSession: true,
      clear: mockAgeClear,
    }),
  },
}));

jest.mock('../draftSpotsStore', () => ({
  useDraftSpotsStore: {
    getState: () => ({
      clearUserDrafts: mockClearUserDrafts,
    }),
  },
}));

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8081';

import { useAuthStore } from '../authStore';

const fetchMock = jest.fn();

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(() => {
  mockGetSession.mockReset();
  mockOnAuthStateChange.mockReset();
  mockSignInWithPassword.mockReset();
  mockVerifyOtp.mockReset();
  mockResend.mockReset();
  mockSignOut.mockReset();
  mockSignInWithOtp.mockReset();
  mockSetSession.mockReset();
  mockExchangeCodeForSession.mockReset();
  mockClearUserDrafts.mockReset();
  mockAgeClear.mockReset();
  fetchMock.mockReset();
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockSignOut.mockResolvedValue({ error: null });
  useAuthStore.setState({
    session: null,
    user: null,
    initializing: true,
    passwordRecovery: false,
  });
});

describe('authStore.init', () => {
  it('restores a saved session and subscribes to auth changes', async () => {
    const session = { access_token: 'token', user: { id: 'user-1' } };
    mockGetSession.mockResolvedValue({ data: { session }, error: null });

    useAuthStore.getState().init();
    await Promise.resolve();

    expect(useAuthStore.getState().user?.id).toBe('user-1');
    expect(useAuthStore.getState().initializing).toBe(false);
    expect(mockOnAuthStateChange).toHaveBeenCalled();
  });

  it('clears auth when restore fails', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: new Error('storage'),
    });
    useAuthStore.getState().init();
    await Promise.resolve();
    expect(useAuthStore.getState()).toMatchObject({
      session: null,
      user: null,
      initializing: false,
    });
  });
});

describe('authStore.signIn', () => {
  it('signs in with trimmed credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    await useAuthStore.getState().signIn('  skater@example.com ', 'SkateU1!');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'skater@example.com',
      password: 'SkateU1!',
    });
  });

  it('keeps invalid credentials generic without looking up the account', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    });

    await expect(
      useAuthStore.getState().signIn('skater@example.com', 'wrong')
    ).rejects.toMatchObject({
      message: 'Invalid login credentials',
      code: 'invalid_credentials',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('authStore.otp', () => {
  it('verifies and resends signup codes', async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockResend.mockResolvedValue({ error: null });
    await useAuthStore.getState().verifyOtp(' skater@example.com ', ' 123456 ');
    await useAuthStore.getState().resendSignUpOtp(' skater@example.com ');
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'skater@example.com',
      token: '123456',
      type: 'signup',
    });
    expect(mockResend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'skater@example.com',
    });
  });
});

describe('authStore.setSessionFromUrl', () => {
  it('returns false for unrelated URLs and throws OAuth errors', async () => {
    await expect(
      useAuthStore.getState().setSessionFromUrl('skateu://home')
    ).resolves.toBe(false);
    await expect(
      useAuthStore.getState().setSessionFromUrl(
        'skateu://auth/callback?error=access_denied&error_description=Nope'
      )
    ).rejects.toThrow('Nope');
  });

  it('sets an implicit session from fragment tokens', async () => {
    mockSetSession.mockResolvedValue({ error: null });
    await expect(
      useAuthStore
        .getState()
        .setSessionFromUrl(
          'skateu://auth/callback#access_token=tok&refresh_token=ref'
        )
    ).resolves.toBe(true);
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'tok',
      refresh_token: 'ref',
    });
  });
});

describe('authStore.signOut and recovery', () => {
  it('clears recovery state and age eligibility', async () => {
    useAuthStore.setState({
      passwordRecovery: true,
      session: { access_token: 'token' } as never,
      user: { id: 'user-1' } as never,
    });
    await useAuthStore.getState().signOut();
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockAgeClear).toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({
      session: null,
      user: null,
      passwordRecovery: false,
    });
  });

  it('clears the local session when remote sign-out fails', async () => {
    mockSignOut.mockResolvedValue({ error: new Error('network') });
    useAuthStore.setState({
      session: { access_token: 'token' } as never,
      user: { id: 'user-1' } as never,
    });
    await expect(useAuthStore.getState().signOut()).rejects.toThrow('network');
    expect(useAuthStore.getState()).toMatchObject({
      session: null,
      user: null,
    });
  });

  it('clears recovery after a completed reset', () => {
    useAuthStore.setState({ passwordRecovery: true });
    useAuthStore.getState().completePasswordRecovery();
    expect(useAuthStore.getState().passwordRecovery).toBe(false);
  });
});

describe('authStore.deleteAccount', () => {
  it('requires a session and a verified proof', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(useAuthStore.getState().deleteAccount()).rejects.toThrow(
      'Sign in to delete your account.'
    );

    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token', user: { id: 'user-1' } } },
    });
    await expect(useAuthStore.getState().deleteAccount()).rejects.toThrow(
      'Enter a new email verification code'
    );
  });

  it('sends a delete OTP', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    await useAuthStore.getState().sendDeleteAccountOtp(' skater@example.com ');
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'skater@example.com',
      options: { shouldCreateUser: false },
    });
  });
});
