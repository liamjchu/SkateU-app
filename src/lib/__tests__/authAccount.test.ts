import {
  ACCOUNT_EXISTS_MESSAGE,
  AccountExistsError,
  APPLE_ACCOUNT_EXISTS_MESSAGE,
  GOOGLE_ACCOUNT_EXISTS_MESSAGE,
  hintForSignupConflict,
  hintFromProviders,
  isAlreadyRegisteredAuthError,
  isObfuscatedExistingUser,
  messageForAccountHint,
  parseAuthAccountHint,
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

  it('maps providers to a signup/sign-in hint without oversharing', () => {
    expect(hintFromProviders(['google'])).toBe('google');
    expect(hintFromProviders(['apple'])).toBe('apple');
    expect(hintFromProviders(['email'])).toBe('password');
    expect(hintFromProviders(['google', 'email'])).toBe('password');
    expect(messageForAccountHint('google')).toBe(GOOGLE_ACCOUNT_EXISTS_MESSAGE);
    expect(messageForAccountHint('apple')).toBe(APPLE_ACCOUNT_EXISTS_MESSAGE);
    expect(messageForAccountHint('password')).toBe(ACCOUNT_EXISTS_MESSAGE);
    expect(new AccountExistsError('google').message).toBe(
      GOOGLE_ACCOUNT_EXISTS_MESSAGE
    );
  });

  it('reads providers from identities when app metadata is missing', () => {
    expect(hintFromProviders([])).toBe('exists');
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

  it('treats unknown lookup results as a generic existing-account conflict', () => {
    expect(parseAuthAccountHint('google')).toBe('google');
    expect(parseAuthAccountHint('nope')).toBe('unknown');
    expect(hintForSignupConflict('unknown')).toBe('exists');
    expect(hintForSignupConflict('google')).toBe('google');
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
