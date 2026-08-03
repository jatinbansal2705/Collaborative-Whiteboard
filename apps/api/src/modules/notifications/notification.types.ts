import type { NotificationType, Prisma } from '../../generated/prisma/client';

export interface MentionEmailJobData {
  to: string;
  recipientName: string | null;
  actorName: string | null;
  boardId: string;
  threadId: string;
  commentId: string;
  bodyPreview: string;
  frontendUrl: string;
}

export type EmailJobData = MentionEmailJobData;

export interface CreateNotificationArgs {
  userId: string;
  type: NotificationType;
  payload: Prisma.InputJsonValue;
}

export function asRecord(
  value: Prisma.JsonValue,
): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value;
  }
  return null;
}
