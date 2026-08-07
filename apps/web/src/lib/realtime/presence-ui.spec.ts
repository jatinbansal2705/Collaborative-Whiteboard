import { describe, expect, it } from 'vitest';
import { userColor, userInitials } from '@/lib/realtime/presence-ui';

describe('userColor', () => {
  it('is deterministic for a given user id', () => {
    expect(userColor('user-1')).toBe(userColor('user-1'));
    expect(userColor('user-2')).toBe(userColor('user-2'));
  });

  it('always returns a palette colour', () => {
    const palette = [
      '#ef4444',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#14b8a6',
      '#3b82f6',
      '#8b5cf6',
      '#d946ef',
      '#ec4899',
      '#84cc16',
    ];
    for (const id of ['a', 'b', 'c', 'long-user-id-1234', 'x']) {
      expect(palette).toContain(userColor(id));
    }
  });

  it('distributes ids across multiple colours', () => {
    const seen = new Set(
      Array.from({ length: 50 }, (_, index) => userColor(`peer-${index}`)),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('userInitials', () => {
  it('returns the first letters of first and last name', () => {
    expect(userInitials('Ada Lovelace')).toBe('AL');
  });

  it('returns a single initial for a one-word name', () => {
    expect(userInitials('ada')).toBe('A');
  });

  it('handles multiple middle names', () => {
    expect(userInitials('alan turing math')).toBe('AM');
  });

  it('uppercases the result', () => {
    expect(userInitials('grace hopper')).toBe('GH');
  });

  it('falls back to a question mark for empty names', () => {
    expect(userInitials('')).toBe('?');
    expect(userInitials(null)).toBe('?');
    expect(userInitials('   ')).toBe('?');
    expect(userInitials(undefined)).toBe('?');
  });
});
