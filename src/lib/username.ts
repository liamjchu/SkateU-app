// Username rules: 3–20 chars, lowercase letters/numbers/underscore, must start
// with a letter. Kept deliberately strict so slugs are clean and URL-safe.
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

// Turn a display name ("John O'Brien") into a candidate username ("johnobrien").
export function slugifyUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '') // drop spaces, punctuation, accents-as-symbols
    .slice(0, USERNAME_MAX);
}

// Returns an error message for display, or null when the value is valid.
export function validateUsername(value: string): string | null {
  if (value.length < USERNAME_MIN) {
    return `Must be at least ${USERNAME_MIN} characters.`;
  }
  if (value.length > USERNAME_MAX) {
    return `Must be ${USERNAME_MAX} characters or fewer.`;
  }
  if (!/^[a-z]/.test(value)) {
    return 'Must start with a letter.';
  }
  if (!USERNAME_PATTERN.test(value)) {
    return 'Use lowercase letters, numbers, and underscores only.';
  }
  return null;
}
