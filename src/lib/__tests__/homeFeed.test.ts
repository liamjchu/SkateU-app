import { MAX_HOME_FEED_OFFSET, parseOffset } from '../homeFeed';

describe('parseOffset', () => {
  it('treats missing, blank, and invalid values as zero', () => {
    expect(parseOffset(null)).toBe(0);
    expect(parseOffset('')).toBe(0);
    expect(parseOffset('  ')).toBe(0);
    expect(parseOffset('1.5')).toBe(0);
    expect(parseOffset('-3')).toBe(0);
    expect(parseOffset('abc')).toBe(0);
  });

  it('accepts whole numbers and clamps to the feed cap', () => {
    expect(parseOffset('0')).toBe(0);
    expect(parseOffset('24')).toBe(24);
    expect(parseOffset(String(MAX_HOME_FEED_OFFSET + 10))).toBe(MAX_HOME_FEED_OFFSET);
  });
});
