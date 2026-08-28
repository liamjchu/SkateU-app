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
    getState: () => ({ confirmedThisSession: true, clear: jest.fn() }),
  },
}));

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8081';

import { ACCOUNT_EXISTS_MESSAGE } from '../../lib/authAccount';
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

    await expect(
      useAuthStore.getState().signUp('skater@example.com', 'Password1!')
    ).rejects.toThrow(ACCOUNT_EXISTS_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a generic account-exists message on a registered-email conflict', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered', code: 'user_already_exists' },
    });

    await expect(
      useAuthStore.getState().signUp('skater@example.com', 'Password1!')
    ).rejects.toThrow(ACCOUNT_EXISTS_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rethrows a generic signup failure', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'weak password' },
    });
    await expect(
      useAuthStore.getState().signUp('skater@example.com', 'short')
    ).rejects.toMatchObject({ message: 'weak password' });
  });
});

describe('signIn invalid credentials', () => {
  it('surfaces the standard invalid-credentials error without an account lookup', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    });

    await expect(
      useAuthStore.getState().signIn('skater@example.com', 'Password1!')
    ).rejects.toMatchObject({
      message: 'Invalid login credentials',
      code: 'invalid_credentials',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
