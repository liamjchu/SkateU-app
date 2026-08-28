import { formatGuestBrowseMessage } from '../guestBrowseCopy';

describe('guest browse copy', () => {
  it('describes guest browsing and defers likes and reports to sign-up', () => {
    const message = formatGuestBrowseMessage();
    expect(message).toBe(
      'Explore schools, spots, the feed, and comments without an account. Sign up to like, add spots, comment, or report.'
    );

    const [guestHalf, signUpHalf] = message.split('Sign up');
    expect(guestHalf.toLowerCase()).not.toContain('like');
    expect(guestHalf.toLowerCase()).not.toContain('report');
    expect(signUpHalf.toLowerCase()).toContain('like');
    expect(signUpHalf.toLowerCase()).toContain('report');
  });
});
