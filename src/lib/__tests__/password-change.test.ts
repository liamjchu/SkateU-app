const mockSignInWithPassword = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (params: unknown) => mockSignInWithPassword(params),
      updateUser: (payload: unknown) => mockUpdateUser(payload),
    },
  },
}));

import { changePassword, setPassword } from '../password-change';

beforeEach(() => {
  mockSignInWithPassword.mockReset();
  mockUpdateUser.mockReset();
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
  });

  it('throws when the update fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: new Error('denied') });
    await expect(setPassword('NewPass1!')).rejects.toThrow('denied');
  });
});
