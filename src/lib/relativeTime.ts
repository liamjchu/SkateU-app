// Formats an ISO timestamp as a short, human-friendly "time ago" string
// (e.g. "just now", "5 days ago", "2 years ago"). Kept dependency-free so we
// avoid pulling in a date library for a single label.

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

type RelativeTimeUnit =
  | 'now'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year';

type RelativeTimeParts = {
  value: number;
  unit: RelativeTimeUnit;
};

const COMPACT_UNIT: Record<Exclude<RelativeTimeUnit, 'now'>, string> = {
  minute: 'm',
  hour: 'h',
  day: 'd',
  week: 'w',
  month: 'mo',
  year: 'y',
};

function ago(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
}

function getRelativeTimeParts(
  isoDate: string | null | undefined,
  now: Date
): RelativeTimeParts | null {
  if (!isoDate) return null;

  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return null;

  // Clamp to 0 so a small clock skew (future timestamp) never reads negative.
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));

  if (seconds < 45) return { value: 0, unit: 'now' };
  if (seconds < HOUR) return { value: Math.round(seconds / MINUTE), unit: 'minute' };
  if (seconds < DAY) return { value: Math.round(seconds / HOUR), unit: 'hour' };
  if (seconds < WEEK) return { value: Math.round(seconds / DAY), unit: 'day' };
  if (seconds < MONTH) return { value: Math.round(seconds / WEEK), unit: 'week' };
  if (seconds < YEAR) return { value: Math.round(seconds / MONTH), unit: 'month' };

  return { value: Math.round(seconds / YEAR), unit: 'year' };
}

// Returns a relative label for `isoDate`, or '' when the input is missing or
// unparseable. `now` is injectable so the logic stays testable.
export function formatRelativeTime(
  isoDate: string | null | undefined,
  now: Date = new Date()
): string {
  const parts = getRelativeTimeParts(isoDate, now);
  if (!parts) return '';
  if (parts.unit === 'now') return 'just now';

  return ago(parts.value, parts.unit);
}

// Compact labels for tight UI like home rails ("2h ago", "3d ago").
export function formatCompactRelativeTime(
  isoDate: string | null | undefined,
  now: Date = new Date()
): string {
  const parts = getRelativeTimeParts(isoDate, now);
  if (!parts) return '';
  if (parts.unit === 'now') return 'just now';

  return `${Math.max(1, parts.value)}${COMPACT_UNIT[parts.unit]} ago`;
}
