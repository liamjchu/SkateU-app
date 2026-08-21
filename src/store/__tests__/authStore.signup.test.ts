const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();

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
      signUp: (params: unknown) => mockSignUp(params),
      signInWithPassword: (params: unknown) => mockSignInWithPassword(params),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
    },
  },
}));

jest.mock('../../store/ageEligibilityStore', () => ({
  useAgeEligibilityStore: {
    getState: () => ({ confirmedThisSession: true }),
  },
}));

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8081';

import { GOOGLE_ACCOUNT_EXISTS_MESSAGE } from '../../lib/authAccount';
import { useAuthStore } from '../authStore';

const fetchMock = jest.fn();

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(() => {
  mockSignUp.mockReset();
  mockSignInWithPassword.mockReset();
  fetchMock.mockReset();
});

describe('signUp existing accounts', () => {
  it('rejects obfuscated existing users instead of sending them to OTP', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'fake', identities: [] }, session: null },
      error: null,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ hint: 'exists' }),
    });

    await expect(
      useAuthStore.getState().signUp('skater@example.com', 'Password1!')
    ).rejects.toThrow('An account already exists with this email. Please sign in instead.');
  });

  it('tells Google-only accounts to continue with Google', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'fake', identities: [] }, session: null },
      error: null,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ hint: 'google' }),
    });

    await expect(
      useAuthStore.getState().signUp('skater@example.com', 'Password1!')
    ).rejects.toThrow(GOOGLE_ACCOUNT_EXISTS_MESSAGE);
  });
});

describe('signIn existing Google accounts', () => {
  it('does not claim a missing password account merely failed credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ hint: 'google' }),
    });

    await expect(
      useAuthStore.getState().signIn('skater@example.com', 'Password1!')
    ).rejects.toThrow(GOOGLE_ACCOUNT_EXISTS_MESSAGE);
  });
});
