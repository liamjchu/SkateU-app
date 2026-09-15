/** System Dynamic Type / accessibility font scale helpers. */

export const LARGE_FONT_SCALE = 1.3;
export const EXTRA_LARGE_FONT_SCALE = 1.8;
export const MAX_LAYOUT_FONT_SCALE = 2.2;

export function normalizeFontScale(fontScale: number): number {
  if (!Number.isFinite(fontScale) || fontScale <= 0) {
    return 1;
  }

  return fontScale;
}

export function isLargeFontScale(fontScale: number): boolean {
  return normalizeFontScale(fontScale) >= LARGE_FONT_SCALE;
}

export function isExtraLargeFontScale(fontScale: number): boolean {
  return normalizeFontScale(fontScale) >= EXTRA_LARGE_FONT_SCALE;
}

/** Default type: center icon + label. Large Dynamic Type: top-align wrapping text. */
export function listRowAlignClass(
  fontScale: number
): 'items-start' | 'items-center' {
  return isLargeFontScale(fontScale) ? 'items-start' : 'items-center';
}

export function listRowLeadingOffsetClass(fontScale: number): string {
  return isLargeFontScale(fontScale) ? 'mt-0.5' : '';
}

export function listRowTrailingOffsetStyle(
  fontScale: number
): { marginTop: number } | undefined {
  return isLargeFontScale(fontScale) ? { marginTop: 8 } : undefined;
}

export function clampedFontScale(
  fontScale: number,
  maxScale = MAX_LAYOUT_FONT_SCALE
): number {
  return Math.min(Math.max(normalizeFontScale(fontScale), 1), maxScale);
}

/** Grow min-heights with Dynamic Type without exploding past a layout cap. */
export function scaledMinHeight(
  base: number,
  fontScale: number,
  maxScale = MAX_LAYOUT_FONT_SCALE
): number {
  return Math.round(base * clampedFontScale(fontScale, maxScale));
}
