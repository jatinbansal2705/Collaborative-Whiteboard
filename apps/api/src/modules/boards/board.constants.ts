import type { BoardMemberRole } from '../../generated/prisma/client';

export const BOARD_TITLE_MAX_LENGTH = 255;
export const BOARD_SEARCH_MAX_LENGTH = 255;
export const BOARD_LIST_DEFAULT_LIMIT = 20;
export const BOARD_LIST_MAX_LIMIT = 100;
export const BOARD_COPY_SUFFIX = ' (copy)';
export const INVITE_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000;

export const BOARD_ROLE_RANK: Record<BoardMemberRole, number> = {
  OWNER: 4,
  EDITOR: 3,
  COMMENTER: 2,
  VIEWER: 1,
};
