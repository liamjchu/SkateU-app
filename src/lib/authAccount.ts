import type { User } from '@supabase/supabase-js';

export type AuthAccountHint = 'google' | 'apple' | 'password' | 'exists' | 'unknown';

export const ACCOUNT_EXISTS_MESSAGE =
  'An account already exists with this email. Please sign in instead.';
export const GOOGLE_ACCOUNT_EXISTS_MESSAGE =
  'This email is already connected to Google. Please continue with Google to sign in.';
export const APPLE_ACCOUNT_EXISTS_MESSAGE =
  'This email is already connected to Apple. Please continue with Apple to sign in.';

export class AccountExistsError extends Error {
  readonly hint: AuthAccountHint;

  constructor(hint: AuthAccountHint) {
    super(messageForAccountHint(hint));
    this.name = 'AccountExistsError';
    this.hint = hint;
  }
}

export function messageForAccountHint(hint: AuthAccountHint): string {
  if (hint === 'google') {
    return GOOGLE_ACCOUNT_EXISTS_MESSAGE;
  }
  if (hint === 'apple') {
    return APPLE_ACCOUNT_EXISTS_MESSAGE;
  }
  return ACCOUNT_EXISTS_MESSAGE;
}

export function isObfuscatedExistingUser(
  user: { identities?: { provider?: string }[] | null } | null | undefined
): boolean {
  return Boolean(user) && (user?.identities?.length ?? 0) === 0;
}

export function isAlreadyRegisteredAuthError(error: {
  message?: string;
  code?: string;
}): boolean {
  const message = (error.message ?? '').toLowerCase();
  const code = (error.code ?? '').toLowerCase();
  return (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('email address is already') ||
    message.includes('user already exists')
  );
}

export function providersFromAuthUser(user: {
  identities?: { provider?: string }[] | null;
  app_metadata?: { providers?: unknown };
}): string[] {
  const fromMetadata = user.app_metadata?.providers;
  if (Array.isArray(fromMetadata)) {
    return fromMetadata.filter((value): value is string => typeof value === 'string');
  }

  return (user.identities ?? [])
    .map((identity) => identity.provider)
    .filter((value): value is string => typeof value === 'string');
}

export function hintFromProviders(providers: string[]): AuthAccountHint {
  const unique = new Set(providers.map((provider) => provider.toLowerCase()));
  const hasPassword = unique.has('email');
  const hasGoogle = unique.has('google');
  const hasApple = unique.has('apple');

  if (hasGoogle && !hasPassword) {
    return 'google';
  }
  if (hasApple && !hasPassword) {
    return 'apple';
  }
  if (hasPassword) {
    return 'password';
  }
  if (hasGoogle) {
    return 'google';
  }
  if (hasApple) {
    return 'apple';
  }
  return 'exists';
}

export function parseAuthAccountHint(value: unknown): AuthAccountHint {
  if (
    value === 'google' ||
    value === 'apple' ||
    value === 'password' ||
    value === 'exists' ||
    value === 'unknown'
  ) {
    return value;
  }
  return 'unknown';
}

export function hintForSignupConflict(value: unknown): AuthAccountHint {
  const hint = parseAuthAccountHint(value);
  return hint === 'unknown' ? 'exists' : hint;
}

export function userCanSignInWithPassword(user: User | null | undefined): boolean {
  if (!user) {
    return false;
  }
  return providersFromAuthUser(user).includes('email');
}

export function primaryOAuthProvider(
  user: User | null | undefined
): 'google' | 'apple' | null {
  const providers = providersFromAuthUser(user ?? { identities: [] });
  if (providers.includes('google')) {
    return 'google';
  }
  if (providers.includes('apple')) {
    return 'apple';
  }
  return null;
}
