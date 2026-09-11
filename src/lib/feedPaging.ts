import { appTabBarHeight } from './tabBar';

export const FEED_SEEN_VIEW_PERCENT = 60;

export function feedPageHeight(
  windowHeight: number,
  bottomInset: number
): number {
  return Math.max(1, Math.round(windowHeight - appTabBarHeight(bottomInset)));
}
