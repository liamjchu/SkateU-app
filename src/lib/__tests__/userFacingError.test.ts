import { sanitizeErrorMessage, toUserFacingError } from '../userFacingError';

describe('user-facing errors', () => {
  it('turns access-token jargon into a sign-in prompt', () => {
    expect(
      sanitizeErrorMessage('Invalid login credentials', 'Try again.')
    ).toBe('Email or password doesn’t match.');
    expect(
      sanitizeErrorMessage('The access token is expired.', 'Try again.')
    ).toBe('Your session expired. Sign in again.');
  });

  it('keeps already-friendly copy', () => {
    expect(sanitizeErrorMessage('Couldn’t save that. Try again in a sec.', 'Nope.')).toBe(
      'Couldn’t save that. Try again in a sec.'
    );
  });

  it('falls back for empty or status-code messages', () => {
    expect(toUserFacingError(new Error(''), 'Try again in a sec.')).toBe(
      'Try again in a sec.'
    );
    expect(
      sanitizeErrorMessage('Request failed with status 502.', 'Try again in a sec.')
    ).toBe('Try again in a sec.');
  });
});
