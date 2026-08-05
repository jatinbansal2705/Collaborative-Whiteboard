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
  /** Monotonic server revision counter bumped on every persisted save. */
  revision: number;
  data: Record<string, unknown> | null;
}

export type BoardVersionKind = 'AUTO' | 'MANUAL';
export type BoardActivityType =
  | 'CREATE'
  | 'EDIT'
  | 'VERSION_RESTORE'
  | 'MANUAL_VERSION'
  | 'ARCHIVE'
  | 'DELETE'
  | 'RESTORE';

export interface BoardAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

/** A snapshot in the board's version history (`GET /boards/:id/versions`). */
export interface BoardVersion {
  id: string;
  versionNo: number;
  kind: BoardVersionKind;
  note: string | null;
  schemaVersion: number;
  elementCount: number;
  createdBy: BoardAuthor;
  createdAt: string;
}

/** A version including its full document payload (`GET .../versions/:versionNo`). */
export interface BoardVersionDetail extends BoardVersion {
  data: Record<string, unknown>;
}

export interface BoardVersionListResult {
  data: BoardVersion[];
  meta: CursorPageMeta;
}

/** One entry in the board activity timeline (`GET /boards/:id/activity`). */
export interface BoardActivity {
  id: string;
  type: BoardActivityType;
  versionNo: number | null;
  details: Record<string, unknown>;
  actor: BoardAuthor;
  createdAt: string;
}

export interface BoardActivityListResult {
  data: BoardActivity[];
  meta: CursorPageMeta;
}

/** Current document + revision (`GET /boards/:id/data`). */
export interface BoardData {
  revision: number;
  data: Record<string, unknown> | null;
}

/** Persisted save result (`PATCH /boards/:id/data`, `POST .../versions`). */
export interface SaveBoardDataResult {
  revision: number;
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
