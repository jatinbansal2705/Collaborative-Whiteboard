import { describe, expect, it } from 'vitest';
import {
  boardTitleSchema,
  createBoardSchema,
  listBoardsQuerySchema,
  updateBoardSchema,
} from '@/lib/validators/board';

describe('boardTitleSchema', () => {
  it('trims and accepts a non-empty title', () => {
    expect(boardTitleSchema.parse('  Sprint planning  ')).toBe(
      'Sprint planning',
    );
  });

  it('rejects an empty title', () => {
    expect(boardTitleSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects a title over the max length', () => {
    expect(boardTitleSchema.safeParse('a'.repeat(256)).success).toBe(false);
  });
});

describe('createBoardSchema', () => {
  it('requires a title or a template', () => {
    expect(createBoardSchema.safeParse({}).success).toBe(false);
    expect(createBoardSchema.safeParse({ title: 'New' }).success).toBe(true);
    expect(
      createBoardSchema.safeParse({
        templateId: 'b4382d61-9ee2-4ee5-8ea6-08b2f1d37bd5',
      }).success,
    ).toBe(true);
  });
});

describe('updateBoardSchema', () => {
  it('rejects an empty update', () => {
    expect(updateBoardSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an invalid thumbnail URL', () => {
    expect(
      updateBoardSchema.safeParse({ thumbnailUrl: 'not-a-url' }).success,
    ).toBe(false);
  });

  it('accepts a valid thumbnail URL', () => {
    expect(
      updateBoardSchema.safeParse({
        thumbnailUrl: 'https://example.com/thumb.png',
      }).success,
    ).toBe(true);
  });
});

describe('listBoardsQuerySchema', () => {
  it('applies the API defaults', () => {
    const query = listBoardsQuerySchema.parse({});
    expect(query).toMatchObject({
      tab: 'recent',
      sortBy: 'updatedAt',
      order: 'desc',
      limit: 20,
    });
  });

  it('rejects an unknown tab', () => {
    expect(listBoardsQuerySchema.safeParse({ tab: 'mine' }).success).toBe(
      false,
    );
  });

  it('rejects a limit over the API maximum', () => {
    expect(listBoardsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('accepts explicit overrides', () => {
    const query = listBoardsQuerySchema.parse({
      tab: 'favourited',
      sortBy: 'title',
      order: 'asc',
      limit: 50,
      search: 'roadmap',
    });
    expect(query).toMatchObject({
      tab: 'favourited',
      sortBy: 'title',
      order: 'asc',
      limit: 50,
      search: 'roadmap',
    });
  });
});
