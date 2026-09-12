export const HOME_RAIL_PAGE_SIZE = 24;
export const HOME_SPOTS_PAGE_SIZE = 6;
export const PROFILE_SPOTS_PAGE_SIZE = 12;
export const FEED_CANDIDATE_LIMIT = 120;
export const MAX_HOME_FEED_OFFSET = HOME_RAIL_PAGE_SIZE * 50;
export const FEED_PREFETCH_REMAINING_ITEMS = 3;
export const FEED_END_REACHED_THRESHOLD = 2;

export function shouldPrefetchMoreItems(
  highestVisibleIndex: number,
  itemCount: number
): boolean {
  if (itemCount <= 0 || highestVisibleIndex < 0) {
    return false;
  }

  return highestVisibleIndex >= itemCount - FEED_PREFETCH_REMAINING_ITEMS;
}

export function parseOffset(raw: string | null): number {
  if (raw == null || raw.trim() === '') {
    return 0;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return 0;
  }

  return Math.min(value, MAX_HOME_FEED_OFFSET);
}
