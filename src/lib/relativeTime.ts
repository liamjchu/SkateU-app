// Formats an ISO timestamp as a short, human-friendly "time ago" string
// (e.g. "just now", "5 days ago", "2 years ago"). Kept dependency-free so we
// avoid pulling in a date library for a single label.

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

function ago(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
}

// Returns a relative label for `isoDate`, or '' when the input is missing or
// unparseable. `now` is injectable so the logic stays testable.
export function formatRelativeTime(
  isoDate: string | null | undefined,
  now: Date = new Date()
): string {
  if (!isoDate) return '';

  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return '';

  // Clamp to 0 so a small clock skew (future timestamp) never reads negative.
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));

  if (seconds < 45) return 'just now';
  if (seconds < HOUR) return ago(Math.round(seconds / MINUTE), 'minute');
  if (seconds < DAY) return ago(Math.round(seconds / HOUR), 'hour');
  if (seconds < WEEK) return ago(Math.round(seconds / DAY), 'day');
  if (seconds < MONTH) return ago(Math.round(seconds / WEEK), 'week');
  if (seconds < YEAR) return ago(Math.round(seconds / MONTH), 'month');

  return ago(Math.round(seconds / YEAR), 'year');
}
