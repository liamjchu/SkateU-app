import {
  ACCOUNT_EXISTS_MESSAGE,
  AccountExistsError,
  isAlreadyRegisteredAuthError,
  isObfuscatedExistingUser,
  primaryOAuthProvider,
  providersFromAuthUser,
  userCanSignInWithPassword,
} from '../authAccount';
import type { User } from '@supabase/supabase-js';

describe('auth account conflicts', () => {
  it('treats empty identities as an existing account', () => {
    expect(isObfuscatedExistingUser({ identities: [] })).toBe(true);
    expect(isObfuscatedExistingUser({ identities: [{ provider: 'email' }] })).toBe(
      false
    );
    expect(isObfuscatedExistingUser(null)).toBe(false);
  });

  it('recognizes already-registered auth errors', () => {
    expect(
      isAlreadyRegisteredAuthError({ message: 'User already registered' })
    ).toBe(true);
    expect(isAlreadyRegisteredAuthError({ code: 'email_exists' })).toBe(true);
    expect(isAlreadyRegisteredAuthError({ message: 'Invalid login credentials' })).toBe(
      false
    );
  });

  it('uses a generic conflict message that does not name a provider', () => {
    expect(new AccountExistsError().message).toBe(ACCOUNT_EXISTS_MESSAGE);
  });

  it('reads providers from identities when app metadata is missing', () => {
    expect(
      providersFromAuthUser({
        identities: [{ provider: 'apple' }],
      })
    ).toEqual(['apple']);
    expect(primaryOAuthProvider(null)).toBeNull();
    expect(
      primaryOAuthProvider({
        identities: [{ provider: 'google' }],
      } as User)
    ).toBe('google');
    expect(
      primaryOAuthProvider({
        identities: [{ provider: 'apple' }],
      } as User)
    ).toBe('apple');
    expect(userCanSignInWithPassword(null)).toBe(false);
  });

  it('detects whether the signed-in user already has a password credential', () => {
    const googleOnly = {
      identities: [{ provider: 'google' }],
      app_metadata: { providers: ['google'] },
    } as User;
    const withPassword = {
      identities: [{ provider: 'google' }, { provider: 'email' }],
      app_metadata: { providers: ['google', 'email'] },
    } as User;

    expect(userCanSignInWithPassword(googleOnly)).toBe(false);
    expect(userCanSignInWithPassword(withPassword)).toBe(true);
  });
});
