export type NotificationType =
  'INVITE' | 'COMMENT' | 'MENTION' | 'BOARD_SHARED' | 'CHAT_MENTION';

/** In-app notification from `GET /notifications` or the `notification:new` socket event. */
export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Paginated notification list result. */
export interface NotificationListResult {
  data: AppNotification[];
  meta: {
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
  };
}
