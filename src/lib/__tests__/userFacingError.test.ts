import { sanitizeErrorMessage, toMutationError, toUserFacingError } from '../userFacingError';

describe('user-facing errors', () => {
  it('turns access-token jargon into a sign-in prompt', () => {
    expect(
      sanitizeErrorMessage('Invalid login credentials', 'Try again.')
    ).toBe('That email or password is incorrect.');
    expect(
      sanitizeErrorMessage('The access token is expired.', 'Try again.')
    ).toBe('Your session expired. Please sign in again.');
  });

  it('professionalizes casual retry copy', () => {
    expect(sanitizeErrorMessage('Couldn’t save that. Try again in a sec.', 'Nope.')).toBe(
      'Couldn’t save that. Please try again.'
    );
  });

  it('falls back for empty or status-code messages', () => {
    expect(toUserFacingError(new Error(''), 'Try again in a sec.')).toBe(
      'Please try again.'
    );
    expect(
      sanitizeErrorMessage('Request failed with status 502.', 'Try again in a sec.')
    ).toBe('Please try again.');
  });

  it('tells the user a connection is required when a save fails offline', () => {
    expect(
      toMutationError(new Error('Network request failed'), 'Please try again.')
    ).toBe('You need a connection to save this.');
  });
});
