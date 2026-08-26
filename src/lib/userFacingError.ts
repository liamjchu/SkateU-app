import { CONNECTION_REQUIRED_SAVE } from './readCache';

// Maps API/store exceptions into short copy a user can actually use.
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

export function toMutationError(error: unknown, fallback: string): string {
  const message = toUserFacingError(error, fallback);
  if (message === 'Check your connection and try again.') {
    return CONNECTION_REQUIRED_SAVE;
  }
  return message;
}

function professionalize(text: string): string {
  return text
    .replace(/try again in a sec\.?/gi, 'Please try again.')
    .replace(/hang on — still posting\.?/gi, 'Still posting. Please wait.')
    .replace(/hang on, the map’s still loading\.?/gi, 'The map is still loading.')
    .replace(/hang on, the map's still loading\.?/gi, 'The map is still loading.')
    .replace(/hang on…/gi, 'Please wait…')
    .replace(/sign in again to keep going\.?/gi, 'Please sign in again.')
    .replace(/that took too long\. please try again\.?/gi, 'This is taking too long. Please try again.')
    .replace(/that took too long\. try again in a sec\.?/gi, 'This is taking too long. Please try again.')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeErrorMessage(raw: string, fallback: string): string {
  const text = raw.trim();
  if (text.length === 0) {
    return professionalize(fallback);
  }

  const lower = text.toLowerCase();

  if (
    lower.includes('invalid login') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid email or password')
  ) {
    return 'That email or password is incorrect.';
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
      return 'Your session expired. Please sign in again.';
    }
    return 'Please sign in again.';
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
    return professionalize(fallback);
  }

  return professionalize(text);
}
