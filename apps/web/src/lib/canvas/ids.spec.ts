import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElementId } from '@/lib/canvas/ids';

describe('createElementId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prepends the el- prefix and uses a UUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(createElementId()).toBe('el-550e8400-e29b-41d4-a716-446655440000');
  });

  it('falls back to a timestamp + random id without crypto.randomUUID', () => {
    vi.stubGlobal('crypto', {});
    const id = createElementId();
    expect(id).toMatch(/^el-[0-9a-z-]+$/);
  });

  it('generates unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createElementId()));
    expect(ids.size).toBe(1000);
  });
});
