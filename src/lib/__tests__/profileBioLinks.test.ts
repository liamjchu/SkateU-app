import {
  isAllowlistedSocialHttpsUrl,
  parseProfileBioSegments,
} from '../profileBioLinks';

describe('isAllowlistedSocialHttpsUrl', () => {
  it('allows well-known public social https URLs', () => {
    expect(isAllowlistedSocialHttpsUrl('https://instagram.com/liam')).toBe(true);
    expect(isAllowlistedSocialHttpsUrl('https://www.tiktok.com/@liam')).toBe(true);
    expect(isAllowlistedSocialHttpsUrl('https://youtu.be/abc')).toBe(true);
    expect(isAllowlistedSocialHttpsUrl('https://x.com/liam')).toBe(true);
  });

  it('rejects http, credentials, shorteners, and lookalike hosts', () => {
    expect(isAllowlistedSocialHttpsUrl('http://instagram.com/liam')).toBe(false);
    expect(
      isAllowlistedSocialHttpsUrl('https://user:pass@instagram.com/liam')
    ).toBe(false);
    expect(isAllowlistedSocialHttpsUrl('https://bit.ly/abc')).toBe(false);
    expect(isAllowlistedSocialHttpsUrl('https://evilinstagram.com/liam')).toBe(
      false
    );
    expect(isAllowlistedSocialHttpsUrl('https://discord.gg/abc')).toBe(false);
  });
});

describe('parseProfileBioSegments', () => {
  it('linkifies allowlisted https URLs and leaves other text alone', () => {
    expect(
      parseProfileBioSegments(
        'Skater. https://instagram.com/liam and https://bit.ly/nope.'
      )
    ).toEqual([
      { type: 'text', value: 'Skater. ' },
      {
        type: 'link',
        value: 'https://instagram.com/liam',
        href: 'https://instagram.com/liam',
      },
      { type: 'text', value: ' and https://bit.ly/nope.' },
    ]);
  });
});
