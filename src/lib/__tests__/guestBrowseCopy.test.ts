import { GUEST_BROWSE_CAPABILITIES, formatGuestBrowseMessage } from '../guestBrowseCopy';

describe('guest browse copy', () => {
  it('describes only capabilities guests currently have', () => {
    const message = formatGuestBrowseMessage();
    expect(message).toContain('Explore SkateU without creating an account.');
    for (const capability of GUEST_BROWSE_CAPABILITIES) {
      expect(message).toContain(capability);
    }
    expect(message).toContain('Create an account when you want to like spots');
    expect(GUEST_BROWSE_CAPABILITIES.join(' ')).not.toContain('like');
    expect(GUEST_BROWSE_CAPABILITIES.join(' ')).not.toContain('report');
  });
});
