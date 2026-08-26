export const HOME_RAIL_PAGE_SIZE = 24;
export const HOME_SPOTS_PAGE_SIZE = 6;
export const MAX_HOME_FEED_OFFSET = HOME_RAIL_PAGE_SIZE * 50;

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
