import { AppleAuthenticationCredentialState } from 'expo-apple-authentication';
import { Platform } from 'react-native';

const mockSignInWithIdToken = jest.fn();
const mockGetCredentialStateAsync = jest.fn();

jest.mock('../clientStorage', () => {
  const storage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  };

  return {
    getClientStorage: () => storage,
    mockAppleUserIdStorage: storage,
  };
});

const { mockAppleUserIdStorage: mockStorage } = jest.requireMock(
  '../clientStorage'
) as {
  mockAppleUserIdStorage: {
    getItem: jest.Mock<Promise<string | null>, [string]>;
    setItem: jest.Mock<Promise<void>, [string, string]>;
    removeItem: jest.Mock<Promise<void>, [string]>;
  };
};

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithIdToken: (params: unknown) => mockSignInWithIdToken(params),
    },
  },
}));

jest.mock('expo-apple-authentication', () => ({
  getCredentialStateAsync: (user: string) => mockGetCredentialStateAsync(user),
  AppleAuthenticationCredentialState: {
    REVOKED: 0,
    AUTHORIZED: 1,
    NOT_FOUND: 2,
    TRANSFERRED: 3,
  },
}));

import {
  checkAppleCredentialStatus,
  signInWithAppleIdentityToken,
  storeAppleUserId,
} from '../appleAuthentication';

const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatform(os: typeof Platform.OS): void {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

function sessionResult() {
  return {
    data: { session: { access_token: 'token' } },
    error: null,
  };
}

beforeEach(() => {
  mockStorage.getItem.mockReset();
  mockStorage.setItem.mockReset();
  mockStorage.removeItem.mockReset();
  mockSignInWithIdToken.mockReset();
  mockGetCredentialStateAsync.mockReset();
  mockStorage.getItem.mockResolvedValue(null);
  mockStorage.setItem.mockResolvedValue(undefined);
  mockStorage.removeItem.mockResolvedValue(undefined);
});

afterEach(() => {
  if (platformDescriptor) {
    Object.defineProperty(Platform, 'OS', platformDescriptor);
  }
});

describe('signInWithAppleIdentityToken', () => {
  it('exchanges the Apple identity token for a Supabase session', async () => {
    mockSignInWithIdToken.mockResolvedValue(sessionResult());

    await signInWithAppleIdentityToken({
      identityToken: 'apple-identity-token',
      user: 'apple-user-001',
      nonce: 'raw-nonce',
    });

    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-identity-token',
      nonce: 'raw-nonce',
    });
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'skateu.appleUserId',
      'apple-user-001'
    );
  });

  it('does not store the Apple user id when Supabase returns an error', async () => {
    mockSignInWithIdToken.mockResolvedValue({
      data: { session: null },
      error: new Error('Invalid Apple identity token'),
    });

    await expect(
      signInWithAppleIdentityToken({
        identityToken: 'bad-token',
        user: 'apple-user-001',
        nonce: 'raw-nonce',
      })
    ).rejects.toThrow('Invalid Apple identity token');

    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  it('does not store the Apple user id when no session is created', async () => {
    mockSignInWithIdToken.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(
      signInWithAppleIdentityToken({
        identityToken: 'apple-identity-token',
        user: 'apple-user-001',
        nonce: 'raw-nonce',
      })
    ).rejects.toThrow('Could not create an app session. Please try again.');

    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('storeAppleUserId', () => {
  it('persists the stable Apple user identifier', async () => {
    await storeAppleUserId('apple-user-001');

    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'skateu.appleUserId',
      'apple-user-001'
    );
  });
});

describe('checkAppleCredentialStatus', () => {
  it('skips the native credential check off iOS', async () => {
    setPlatform('android');

    await expect(checkAppleCredentialStatus()).resolves.toBeNull();
    expect(mockStorage.getItem).not.toHaveBeenCalled();
    expect(mockGetCredentialStateAsync).not.toHaveBeenCalled();
  });

  it('returns null when no Apple user has signed in on this device', async () => {
    setPlatform('ios');
    mockStorage.getItem.mockResolvedValue(null);

    await expect(checkAppleCredentialStatus()).resolves.toBeNull();
    expect(mockGetCredentialStateAsync).not.toHaveBeenCalled();
  });

  it('keeps the stored Apple user when the credential is still authorized', async () => {
    setPlatform('ios');
    mockStorage.getItem.mockResolvedValue('apple-user-001');
    mockGetCredentialStateAsync.mockResolvedValue(
      AppleAuthenticationCredentialState.AUTHORIZED
    );

    await expect(checkAppleCredentialStatus()).resolves.toBe(
      AppleAuthenticationCredentialState.AUTHORIZED
    );
    expect(mockGetCredentialStateAsync).toHaveBeenCalledWith('apple-user-001');
    expect(mockStorage.removeItem).not.toHaveBeenCalled();
  });

  it('clears the stored Apple user when Apple has revoked the credential', async () => {
    setPlatform('ios');
    mockStorage.getItem.mockResolvedValue('apple-user-001');
    mockGetCredentialStateAsync.mockResolvedValue(
      AppleAuthenticationCredentialState.REVOKED
    );

    await expect(checkAppleCredentialStatus()).resolves.toBe(
      AppleAuthenticationCredentialState.REVOKED
    );
    expect(mockStorage.removeItem).toHaveBeenCalledWith('skateu.appleUserId');
  });
});
