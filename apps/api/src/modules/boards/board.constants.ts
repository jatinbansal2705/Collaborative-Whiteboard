import type { BoardMemberRole } from '../../generated/prisma/client';

export const BOARD_TITLE_MAX_LENGTH = 255;
export const BOARD_SEARCH_MAX_LENGTH = 255;
export const BOARD_LIST_DEFAULT_LIMIT = 20;
export const BOARD_LIST_MAX_LIMIT = 100;
export const BOARD_COPY_SUFFIX = ' (copy)';
export const INVITE_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;

/** Hard cap on serialized elements a single document save may contain. */
export const BOARD_DATA_MAX_ELEMENTS = 10_000;

export const VERSIONS_DEFAULT_LIMIT = 20;
export const VERSIONS_MAX_LIMIT = 100;
/** Auto snapshots older than this are pruned; manual snapshots are kept forever. */
export const VERSIONS_AUTO_RETENTION = 100;
export const VERSION_NOTE_MAX_LENGTH = 255;

export const ACTIVITY_DEFAULT_LIMIT = 30;
export const ACTIVITY_MAX_LIMIT = 100;

export const BOARD_ROLE_RANK: Record<BoardMemberRole, number> = {
  OWNER: 4,
  EDITOR: 3,
  COMMENTER: 2,
  VIEWER: 1,
};
