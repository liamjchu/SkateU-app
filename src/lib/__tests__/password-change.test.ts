const mockSignInWithPassword = jest.fn();
const mockUpdateUser = jest.fn();
const mockGetSession = jest.fn();
const mockRefreshSession = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (params: unknown) => mockSignInWithPassword(params),
      updateUser: (payload: unknown) => mockUpdateUser(payload),
      getSession: () => mockGetSession(),
      refreshSession: () => mockRefreshSession(),
    },
  },
}));

jest.mock('../api', () => ({
  getApiUrl: (path: string) => `https://app.test${path}`,
}));

import { changePassword, setPassword, toPasswordChangeErrorMessage } from '../password-change';

const originalFetch = global.fetch;

beforeEach(() => {
  mockSignInWithPassword.mockReset();
  mockUpdateUser.mockReset();
  mockGetSession.mockReset();
  mockRefreshSession.mockReset();
  mockGetSession.mockResolvedValue({
    data: {
      session: {
        access_token: 'token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          email: 'skater@example.com',
          email_confirmed_at: '2026-01-01T00:00:00Z',
          identities: [{ provider: 'google' }],
          app_metadata: { providers: ['google'] },
        },
      },
    },
    error: null,
  });
  mockRefreshSession.mockResolvedValue({ error: null });
  global.fetch = jest.fn(async (input, init) => {
    if (String(input).includes('/api/set-password')) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (typeof originalFetch === 'function') {
      return originalFetch(input, init);
    }
    return new Response('', { status: 204 });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('changePassword', () => {
  it('reauthenticates then replaces the password', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });

    await changePassword({
      email: '  skater@example.com ',
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'skater@example.com',
      password: 'OldPass1!',
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewPass1!' });
  });

  it('maps invalid current credentials to a friendly error', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });

    await expect(
      changePassword({
        email: 'skater@example.com',
        currentPassword: 'wrong',
        newPassword: 'NewPass1!',
      })
    ).rejects.toThrow('Incorrect current password.');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('rethrows other reauthentication errors', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'network down' },
    });

    await expect(
      changePassword({
        email: 'skater@example.com',
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass1!',
      })
    ).rejects.toEqual({ message: 'network down' });
  });

  it('throws when the password update fails', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: new Error('too weak') });

    await expect(
      changePassword({
        email: 'skater@example.com',
        currentPassword: 'OldPass1!',
        newPassword: 'weak',
      })
    ).rejects.toThrow('too weak');
  });
});

describe('setPassword', () => {
  it('adds a password credential on the current session', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    await setPassword('NewPass1!');
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewPass1!' });
    expect(global.fetch).not.toHaveBeenCalledWith(
      'https://app.test/api/set-password',
      expect.anything()
    );
  });

  it('uses the admin API when GoTrue requires a current password', async () => {
    mockUpdateUser.mockResolvedValue({
      error: {
        message: 'Current password required when setting new password.',
        code: 'current_password_required',
        status: 400,
        name: 'AuthApiError',
      },
    });

    await setPassword('NewPass1!');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://app.test/api/set-password',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      })
    );
    expect(mockRefreshSession).toHaveBeenCalled();
  });

  it('throws when the update fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: new Error('denied') });
    await expect(setPassword('NewPass1!')).rejects.toThrow('denied');
  });
});

describe('toPasswordChangeErrorMessage', () => {
  it('keeps the incorrect current password copy', () => {
    expect(
      toPasswordChangeErrorMessage(new Error('Incorrect current password.'))
    ).toBe('Incorrect current password.');
  });

  it('maps a weak or leaked password', () => {
    expect(
      toPasswordChangeErrorMessage({
        message: 'Password is known to be weak and easy to guess',
        code: 'weak_password',
      })
    ).toBe('That password is too easy to guess. Choose a different one.');
  });

  it('falls back for unknown failures', () => {
    expect(toPasswordChangeErrorMessage(new Error('denied'))).toBe(
      'We couldn’t update your password right now. Please try again.'
    );
  });
});
