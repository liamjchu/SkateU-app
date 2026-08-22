import type { User } from '@supabase/supabase-js';

export const ACCOUNT_EXISTS_MESSAGE =
  'An account already exists with this email. Please sign in instead.';

export class AccountExistsError extends Error {
  constructor() {
    super(ACCOUNT_EXISTS_MESSAGE);
    this.name = 'AccountExistsError';
  }
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
