export const HOME_RAIL_PAGE_SIZE = 24;

export function parseOffset(raw: string | null): number {
  if (raw == null || raw.trim() === '') {
    return 0;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return 0;
  }

  return value;
}
