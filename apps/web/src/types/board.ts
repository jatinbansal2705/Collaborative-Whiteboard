export type BoardStatus = 'ACTIVE' | 'ARCHIVED';
export type BoardMemberRole = 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER';
export type BoardTab = 'recent' | 'shared' | 'favourited';
export type BoardSortBy = 'updatedAt' | 'createdAt' | 'title' | 'memberCount';
export type BoardSortOrder = 'asc' | 'desc';

/** Board card returned by list/detail endpoints. */
export interface BoardSummary {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  isTemplate: boolean;
  isArchived: boolean;
  status: BoardStatus;
  memberCount: number;
  isFavourite: boolean;
  myRole: BoardMemberRole;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

/** Board detail including the canvas document payload. */
export interface BoardDetail extends BoardSummary {
  data: Record<string, unknown> | null;
}

/** Cursor pagination metadata (`GET /boards`, `GET /notifications`). */
export interface CursorPageMeta {
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
}

/** Paginated board list result. */
export interface BoardListResult {
  data: BoardSummary[];
  meta: CursorPageMeta;
}

/** `DELETE /boards/:id` */
export interface BoardDeleted {
  deleted: boolean;
  id: string;
}

/** Favourite toggle result. */
export interface FavouriteStatus {
  boardId: string;
  isFavourite: boolean;
}

/** A board member in the roster (`GET /boards/:id/members`). */
export interface BoardMember {
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: BoardMemberRole;
  addedAt: string;
}

/** A pending email invite in the roster. */
export interface PendingInvite {
  id: string;
  email: string;
  role: BoardMemberRole;
  expiresAt: string | null;
  createdAt: string;
}

export type BoardRosterItem = BoardMember | PendingInvite;

export type AddMemberResult =
  | { kind: 'member'; member: BoardMember }
  | { kind: 'pendingInvite'; invite: PendingInvite };

/** Board list query parameters (`GET /boards`). */
export type ListBoardsQuery = {
  tab?: BoardTab;
  search?: string;
  sortBy?: BoardSortBy;
  order?: BoardSortOrder;
  cursor?: string;
  limit?: number;
  archived?: boolean;
  template?: boolean;
  ownedByMe?: boolean;
};
