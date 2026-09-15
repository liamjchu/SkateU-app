import {
  clampedFontScale,
  isExtraLargeFontScale,
  isLargeFontScale,
  listRowAlignClass,
  listRowLeadingOffsetClass,
  listRowTrailingOffsetStyle,
  normalizeFontScale,
  scaledMinHeight,
} from '../fontScale';
import { mapExploreChromeContentHeight } from '../mapFocus';

describe('fontScale', () => {
  it('treats invalid values as 1', () => {
    expect(normalizeFontScale(Number.NaN)).toBe(1);
    expect(normalizeFontScale(0)).toBe(1);
    expect(normalizeFontScale(-2)).toBe(1);
  });

  it('flags large accessibility sizes', () => {
    expect(isLargeFontScale(1)).toBe(false);
    expect(isLargeFontScale(1.3)).toBe(true);
    expect(isExtraLargeFontScale(1.5)).toBe(false);
    expect(isExtraLargeFontScale(1.8)).toBe(true);
  });

  it('grows min-heights with font scale and caps the multiplier', () => {
    expect(scaledMinHeight(48, 1)).toBe(48);
    expect(scaledMinHeight(48, 2)).toBe(96);
    expect(scaledMinHeight(48, 4)).toBe(Math.round(48 * 2.2));
  });

  it('clamps extreme layout scale', () => {
    expect(clampedFontScale(0.5)).toBe(1);
    expect(clampedFontScale(3)).toBe(2.2);
  });

  it('centers list rows at default type and top-aligns at large type', () => {
    expect(listRowAlignClass(1)).toBe('items-center');
    expect(listRowLeadingOffsetClass(1)).toBe('');
    expect(listRowTrailingOffsetStyle(1)).toBeUndefined();
    expect(listRowAlignClass(1.3)).toBe('items-start');
    expect(listRowLeadingOffsetClass(1.3)).toBe('mt-0.5');
    expect(listRowTrailingOffsetStyle(1.3)).toEqual({ marginTop: 8 });
  });
});

describe('mapExploreChromeContentHeight', () => {
  it('matches the default search + campus chip height at 1x', () => {
    expect(mapExploreChromeContentHeight(1)).toBe(108);
  });

  it('grows when Dynamic Type is larger', () => {
    expect(mapExploreChromeContentHeight(2)).toBeGreaterThan(108);
  });
});
