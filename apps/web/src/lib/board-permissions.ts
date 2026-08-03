import type { BoardMemberRole } from '@/types/board';

/**
 * Board role hierarchy matching the API's `BOARD_ROLE_RANK` (ADR-0014).
 * Higher rank = more capabilities; OWNER is the only role that can delete.
 */
const BOARD_ROLE_RANK: Record<BoardMemberRole, number> = {
  VIEWER: 1,
  COMMENTER: 2,
  EDITOR: 3,
  OWNER: 4,
} as const;

export function roleRank(role: BoardMemberRole): number {
  return BOARD_ROLE_RANK[role];
}

/** Every member can view, duplicate, and star a board. */
export function canDuplicate(role: BoardMemberRole): boolean {
  return roleRank(role) >= BOARD_ROLE_RANK.VIEWER;
}

/** Every member can toggle the favourite star. */
export function canToggleFavourite(role: BoardMemberRole): boolean {
  return roleRank(role) >= BOARD_ROLE_RANK.VIEWER;
}

/** Renaming and archiving require at least the EDITOR role. */
export function canEditMetadata(role: BoardMemberRole): boolean {
  return roleRank(role) >= BOARD_ROLE_RANK.EDITOR;
}

export function canArchive(role: BoardMemberRole): boolean {
  return roleRank(role) >= BOARD_ROLE_RANK.EDITOR;
}

export function canRename(role: BoardMemberRole): boolean {
  return roleRank(role) >= BOARD_ROLE_RANK.EDITOR;
}

/** Only the OWNER can soft-delete a board. */
export function canDelete(role: BoardMemberRole): boolean {
  return roleRank(role) >= BOARD_ROLE_RANK.OWNER;
}
