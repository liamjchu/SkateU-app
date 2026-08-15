export const PASSWORD_REQUIREMENTS =
  'At least 8 characters, with uppercase, lowercase, a number, and a special character.';

export const getPasswordRequirementStatus = (password: string) => ({
  minLength: password.length >= 8,
  upperAndLowerCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
  number: /\d/.test(password),
  specialCharacter: /[^A-Za-z0-9]/.test(password),
});

/**
 * Central password policy for client-side feedback. Keep this aligned with the
 * Supabase Auth password policy. If the app already gains a validator/schema,
 * replace this function's body with that shared validation call.
 */
export const validatePassword = (password: string): string | null => {
  const requirements = getPasswordRequirementStatus(password);

  if (!requirements.minLength) {
    return 'Password needs at least 8 characters.';
  }
  if (!requirements.upperAndLowerCase) {
    return 'Password needs uppercase and lowercase letters.';
  }
  if (!requirements.number) {
    return 'Password needs a number.';
  }
  if (!requirements.specialCharacter) {
    return 'Password needs a special character.';
  }

  return null;
};
