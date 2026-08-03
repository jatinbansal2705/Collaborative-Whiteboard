import { describe, expect, it } from 'vitest';
import {
  canArchive,
  canDelete,
  canDuplicate,
  canEditMetadata,
  canRename,
  canToggleFavourite,
  roleRank,
} from '@/lib/board-permissions';
import type { BoardMemberRole } from '@/types/board';

const ROLES: BoardMemberRole[] = ['VIEWER', 'COMMENTER', 'EDITOR', 'OWNER'];

describe('roleRank', () => {
  it('orders roles so OWNER outranks EDITOR outranks VIEWER', () => {
    expect(roleRank('VIEWER')).toBe(1);
    expect(roleRank('COMMENTER')).toBe(2);
    expect(roleRank('EDITOR')).toBe(3);
    expect(roleRank('OWNER')).toBe(4);
  });
});

describe('board permissions', () => {
  it('lets every member view, duplicate, and star a board', () => {
    for (const role of ROLES) {
      expect(canDuplicate(role)).toBe(true);
      expect(canToggleFavourite(role)).toBe(true);
    }
  });

  it('restricts metadata edits, rename, and archive to editors', () => {
    expect(canEditMetadata('VIEWER')).toBe(false);
    expect(canEditMetadata('COMMENTER')).toBe(false);
    expect(canEditMetadata('EDITOR')).toBe(true);
    expect(canEditMetadata('OWNER')).toBe(true);

    expect(canRename('COMMENTER')).toBe(false);
    expect(canRename('EDITOR')).toBe(true);

    expect(canArchive('COMMENTER')).toBe(false);
    expect(canArchive('EDITOR')).toBe(true);
  });

  it('reserves deletion for the owner only', () => {
    expect(canDelete('VIEWER')).toBe(false);
    expect(canDelete('COMMENTER')).toBe(false);
    expect(canDelete('EDITOR')).toBe(false);
    expect(canDelete('OWNER')).toBe(true);
  });
});
