export const APP_TAB_BAR_CONTENT_HEIGHT = 48;

export function appTabBarHeight(bottomInset: number): number {
  return APP_TAB_BAR_CONTENT_HEIGHT + Math.max(bottomInset, 0);
}
