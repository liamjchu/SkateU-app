import { shouldMountPagerImage } from '../spotMediaPager';

describe('shouldMountPagerImage', () => {
  it('mounts the current photo and its immediate neighbors', () => {
    expect(shouldMountPagerImage(0, 0)).toBe(true);
    expect(shouldMountPagerImage(1, 0)).toBe(true);
    expect(shouldMountPagerImage(2, 0)).toBe(false);
    expect(shouldMountPagerImage(1, 2)).toBe(true);
    expect(shouldMountPagerImage(2, 2)).toBe(true);
    expect(shouldMountPagerImage(3, 2)).toBe(true);
    expect(shouldMountPagerImage(0, 2)).toBe(false);
  });
});
