import { formatCompactRelativeTime, formatRelativeTime } from '../relativeTime';

const now = new Date('2026-08-21T18:00:00.000Z');

function isoMinutesAgo(minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

describe('formatRelativeTime', () => {
  it('returns empty for missing or invalid dates', () => {
    expect(formatRelativeTime(null, now)).toBe('');
    expect(formatRelativeTime('', now)).toBe('');
    expect(formatRelativeTime('not-a-date', now)).toBe('');
  });

  it('uses just now for recent timestamps, including small clock skew', () => {
    expect(formatRelativeTime(now.toISOString(), now)).toBe('just now');
    expect(
      formatRelativeTime(new Date(now.getTime() + 5_000).toISOString(), now)
    ).toBe('just now');
  });

  it('picks the matching unit', () => {
    expect(formatRelativeTime(isoMinutesAgo(5), now)).toBe('5 minutes ago');
    expect(formatRelativeTime(isoMinutesAgo(60), now)).toBe('1 hour ago');
    expect(formatRelativeTime(isoMinutesAgo(60 * 26), now)).toBe('1 day ago');
    expect(formatRelativeTime(isoMinutesAgo(60 * 24 * 10), now)).toBe('1 week ago');
    expect(formatRelativeTime(isoMinutesAgo(60 * 24 * 40), now)).toBe('1 month ago');
    expect(formatRelativeTime(isoMinutesAgo(60 * 24 * 400), now)).toBe('1 year ago');
  });
});

describe('formatCompactRelativeTime', () => {
  it('uses compact labels', () => {
    expect(formatCompactRelativeTime(null, now)).toBe('');
    expect(formatCompactRelativeTime(now.toISOString(), now)).toBe('just now');
    expect(formatCompactRelativeTime(isoMinutesAgo(5), now)).toBe('5m ago');
    expect(formatCompactRelativeTime(isoMinutesAgo(60), now)).toBe('1h ago');
    expect(formatCompactRelativeTime(isoMinutesAgo(60 * 26), now)).toBe('1d ago');
  });
});
