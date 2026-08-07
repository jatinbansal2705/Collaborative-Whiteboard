import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cn('a', undefined, null, false, 'b', 0)).toBe('a b');
  });

  it('accepts nested arrays and objects', () => {
    expect(cn(['a', { b: true, c: false }], 'd')).toBe('a b d');
  });

  it('resolves tailwind conflicts with the last class winning', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('keeps independent classes', () => {
    expect(cn('flex', 'px-2', 'text-sm')).toBe('flex px-2 text-sm');
  });
});
