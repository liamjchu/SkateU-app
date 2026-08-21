const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `skateu://${path}`,
}));

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (email: string, options: unknown) =>
        mockResetPasswordForEmail(email, options),
      updateUser: (payload: unknown) => mockUpdateUser(payload),
    },
  },
}));

import { requestPasswordResetEmail, updatePassword } from '../password-reset';

beforeEach(() => {
  mockResetPasswordForEmail.mockReset();
  mockUpdateUser.mockReset();
});

describe('requestPasswordResetEmail', () => {
  it('sends the recovery email to the app callback', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    await requestPasswordResetEmail('  skater@example.com  ');
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('skater@example.com', {
      redirectTo: 'skateu://auth/reset-password',
    });
  });

  it('throws the Supabase error', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: new Error('rate limited'),
    });
    await expect(requestPasswordResetEmail('skater@example.com')).rejects.toThrow(
      'rate limited'
    );
  });
});

describe('updatePassword', () => {
  it('requires an active recovery session', async () => {
    await expect(updatePassword('SkateU1!', false)).rejects.toThrow(
      'Open the reset link from your email first.'
    );
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('updates the password during recovery', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    await updatePassword('SkateU1!', true);
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'SkateU1!' });
  });

  it('throws when the update fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: new Error('too weak') });
    await expect(updatePassword('SkateU1!', true)).rejects.toThrow('too weak');
  });
});
