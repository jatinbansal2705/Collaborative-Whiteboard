import { describe, expect, it } from 'vitest';
import { formatRelativeTime, formatShortDate } from '@/lib/date';

describe('formatShortDate', () => {
  it('renders a month/day for dates in the current year', () => {
    const iso = new Date(new Date().getFullYear(), 2, 3, 12).toISOString();
    expect(formatShortDate(iso)).toMatch(/^Mar 3$/);
  });

  it('includes the year for other years', () => {
    expect(formatShortDate('2020-05-07T00:00:00.000Z')).toMatch(
      /^May 7, 2020$/,
    );
  });

  it('returns an empty string for invalid input', () => {
    expect(formatShortDate('not-a-date')).toBe('');
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-08-03T12:00:00.000Z');

  it('labels recent edits in seconds/minutes/hours/days', () => {
    expect(formatRelativeTime('2026-08-03T11:59:45.000Z', now)).toBe(
      'just now',
    );
    expect(formatRelativeTime('2026-08-03T11:40:00.000Z', now)).toBe('20m ago');
    expect(formatRelativeTime('2026-08-03T09:00:00.000Z', now)).toBe('3h ago');
    expect(formatRelativeTime('2026-07-31T12:00:00.000Z', now)).toBe('3d ago');
  });

  it('falls back to a short date for edits a week or more ago', () => {
    expect(formatRelativeTime('2026-07-20T00:00:00.000Z', now)).toMatch(
      /^Jul 20$/,
    );
  });

  it('falls back to a short date for future timestamps', () => {
    expect(formatRelativeTime('2026-08-04T00:00:00.000Z', now)).toMatch(
      /^Aug 4$/,
    );
  });

  it('returns an empty string for invalid input', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('');
  });
});
