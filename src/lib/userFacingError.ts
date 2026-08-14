// Maps API/store exceptions into short copy a skater can actually use.
// Keep jargon (tokens, JWT, status codes) out of the UI.

export function toUserFacingError(error: unknown, fallback: string): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  return sanitizeErrorMessage(raw, fallback);
}

export function sanitizeErrorMessage(raw: string, fallback: string): string {
  const text = raw.trim();
  if (text.length === 0) {
    return fallback;
  }

  const lower = text.toLowerCase();

  if (
    lower.includes('invalid login') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid email or password')
  ) {
    return 'Email or password doesn’t match.';
  }

  if (
    lower.includes('access token') ||
    lower.includes('jwt') ||
    lower.includes('invalid token') ||
    lower.includes('not authenticated') ||
    lower.includes('authentication is required') ||
    lower.includes('authorization') ||
    lower.includes('bearer')
  ) {
    if (lower.includes('expir')) {
      return 'Your session expired. Sign in again.';
    }
    return 'Sign in again to keep going.';
  }

  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('internet') ||
    lower.includes('network request failed')
  ) {
    return 'Check your connection and try again.';
  }

  if (/^request failed with status/i.test(text) || /\bstatus \d{3}\b/i.test(text)) {
    return fallback;
  }

  return text;
}
