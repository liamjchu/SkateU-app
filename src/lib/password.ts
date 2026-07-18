export const PASSWORD_REQUIREMENTS =
  'Use at least 8 characters with uppercase, lowercase, a number, and a special character.';

/**
 * Central password policy for client-side feedback. Keep this aligned with the
 * Supabase Auth password policy. If the app already gains a validator/schema,
 * replace this function's body with that shared validation call.
 */
export const validatePassword = (password: string): string | null => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return 'Password must include uppercase and lowercase letters.';
  }
  if (!/\d/.test(password)) {
    return 'Password must include a number.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include a special character.';
  }

  return null;
};
