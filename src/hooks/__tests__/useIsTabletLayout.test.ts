import {
  getTabletSheetWidth,
  isTabletLayout,
  TABLET_MIN_HEIGHT,
  TABLET_MIN_WIDTH,
  TABLET_SHEET_INSET,
  TABLET_SHEET_MAX_WIDTH,
} from '../useIsTabletLayout';

describe('isTabletLayout', () => {
  it('requires both the min width and min height', () => {
    expect(isTabletLayout(TABLET_MIN_WIDTH, TABLET_MIN_HEIGHT)).toBe(true);
    expect(isTabletLayout(TABLET_MIN_WIDTH - 1, TABLET_MIN_HEIGHT)).toBe(false);
    expect(isTabletLayout(TABLET_MIN_WIDTH, TABLET_MIN_HEIGHT - 1)).toBe(false);
  });

  it('matches a typical iPad portrait window', () => {
    expect(isTabletLayout(1024, 1366)).toBe(true);
  });
});

describe('getTabletSheetWidth', () => {
  it('caps at the tablet sheet max width', () => {
    expect(getTabletSheetWidth(1180)).toBe(TABLET_SHEET_MAX_WIDTH);
  });

  it('leaves 24px inset on each side when the window is narrower', () => {
    expect(getTabletSheetWidth(500)).toBe(500 - TABLET_SHEET_INSET * 2);
  });
});
