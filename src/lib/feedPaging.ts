import { appTabBarHeight } from './tabBar';

export const FEED_SEEN_VIEW_PERCENT = 60;
/** Slightly above RN "fast" (~0.99) so paging stays snappy without a hard stop. */
export const FEED_DECELERATION_RATE = 0.992;

export function feedPageHeight(
  windowHeight: number,
  bottomInset: number
): number {
  return Math.max(1, Math.round(windowHeight - appTabBarHeight(bottomInset)));
}
