import { z } from 'zod';
import {
  PRESENCE_ACTIVITY,
  SELECTION_IDS_MAX,
  type PresenceActivity,
} from './events';

/** Board ids are UUIDs (see Prisma `Board.id`). */
export const boardIdSchema = z.string().uuid();

export const boardMemberRoleSchema = z.enum([
  'OWNER',
  'EDITOR',
  'COMMENTER',
  'VIEWER',
]);

export type BoardMemberRole = z.infer<typeof boardMemberRoleSchema>;

const presenceActivitySchema = z.enum([
  PRESENCE_ACTIVITY.ONLINE,
  PRESENCE_ACTIVITY.AWAY,
  PRESENCE_ACTIVITY.IDLE,
]);

// ---------------------------------------------------------------------------
// Client -> server payloads
// ---------------------------------------------------------------------------

export const joinBoardPayloadSchema = z.object({
  boardId: boardIdSchema,
});
export type JoinBoardPayload = z.infer<typeof joinBoardPayloadSchema>;

export const leaveBoardPayloadSchema = joinBoardPayloadSchema;
export type LeaveBoardPayload = z.infer<typeof leaveBoardPayloadSchema>;

export const presenceUpdatePayloadSchema = z.object({
  tool: z.string().max(64).nullable().optional(),
  activity: presenceActivitySchema.optional(),
});
export type PresenceUpdatePayload = z.infer<typeof presenceUpdatePayloadSchema>;

export const cursorMovePayloadSchema = z.object({
  boardId: boardIdSchema,
  x: z.number().finite(),
  y: z.number().finite(),
});
export type CursorMovePayload = z.infer<typeof cursorMovePayloadSchema>;

/** One element delta as defined by PRD Part 7 (`id, patch, version, lastModifiedBy, timestamp`). */
export const elementPatchSchema = z.object({
  id: z.string().min(1).max(128),
  patch: z.record(z.string(), z.unknown()).refine((value) => {
    const entries = Object.values(value);
    return entries.length > 0 && entries.every((entry) => entry !== undefined);
  }, 'At least one non-undefined patch key is required'),
  version: z.number().int().nonnegative(),
  lastModifiedBy: z.string().min(1).max(128).optional(),
  timestamp: z.number().int().nonnegative(),
});
export type ElementPatch = z.infer<typeof elementPatchSchema>;

export const drawPatchPayloadSchema = z
  .object({
    boardId: boardIdSchema,
  })
  .merge(elementPatchSchema);
export type DrawPatchPayload = z.infer<typeof drawPatchPayloadSchema>;

export const boardElementSchema = z
  .object({
    id: z.string().min(1).max(128),
    type: z.string().min(1).max(64),
    version: z.number().int().nonnegative(),
  })
  .passthrough();
export type BoardElement = z.infer<typeof boardElementSchema>;

export const elementCreatePayloadSchema = z.object({
  boardId: boardIdSchema,
  element: boardElementSchema,
});
export type ElementCreatePayload = z.infer<typeof elementCreatePayloadSchema>;

export const elementDeletePayloadSchema = z.object({
  boardId: boardIdSchema,
  id: z.string().min(1).max(128),
  version: z.number().int().nonnegative(),
});
export type ElementDeletePayload = z.infer<typeof elementDeletePayloadSchema>;

export const selectionUpdatePayloadSchema = z.object({
  boardId: boardIdSchema,
  selectedIds: z.array(z.string().min(1).max(128)).max(SELECTION_IDS_MAX),
});
export type SelectionUpdatePayload = z.infer<
  typeof selectionUpdatePayloadSchema
>;

/** Client -> server: a typing indicator update (server throttles + broadcasts). */
export const chatTypingPayloadSchema = z.object({
  boardId: boardIdSchema,
  isTyping: z.boolean(),
});
export type ChatTypingPayload = z.infer<typeof chatTypingPayloadSchema>;

/** Client -> server: advance the caller's read receipt to a chat message. */
export const chatReadPayloadSchema = z.object({
  boardId: boardIdSchema,
  lastReadMessageId: z.string().uuid(),
});
export type ChatReadPayload = z.infer<typeof chatReadPayloadSchema>;

// ---------------------------------------------------------------------------
// Server -> client payloads
// ---------------------------------------------------------------------------

/** A member in the presence roster (socketId is internal to the server). */
export const presenceMemberSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().max(120).nullable(),
  avatarUrl: z.string().max(2048).nullable(),
  role: boardMemberRoleSchema,
  activity: presenceActivitySchema,
  tool: z.string().max(64).nullable(),
  lastSeenAt: z.string(),
});
export type PresenceMember = z.infer<typeof presenceMemberSchema>;

export const presenceRosterPayloadSchema = z.object({
  presence: z.array(presenceMemberSchema),
});
export type PresenceRosterPayload = z.infer<typeof presenceRosterPayloadSchema>;

export const presenceUpdateEventSchema = z.object({
  userId: z.string().uuid(),
  presence: z.object({
    activity: presenceActivitySchema,
    tool: z.string().max(64).nullable(),
  }),
});
export type PresenceUpdateEvent = z.infer<typeof presenceUpdateEventSchema>;

export const cursorMoveEventSchema = z.object({
  boardId: boardIdSchema,
  userId: z.string().uuid(),
  x: z.number().finite(),
  y: z.number().finite(),
});
export type CursorMoveEvent = z.infer<typeof cursorMoveEventSchema>;

export const drawPatchEventSchema = z
  .object({
    boardId: boardIdSchema,
    userId: z.string().uuid(),
  })
  .merge(elementPatchSchema)
  .omit({ lastModifiedBy: true });
export type DrawPatchEvent = z.infer<typeof drawPatchEventSchema>;

export const elementCreateEventSchema = z.object({
  boardId: boardIdSchema,
  userId: z.string().uuid(),
  element: boardElementSchema,
});
export type ElementCreateEvent = z.infer<typeof elementCreateEventSchema>;

export const elementDeleteEventSchema = z.object({
  boardId: boardIdSchema,
  userId: z.string().uuid(),
  id: z.string().min(1).max(128),
  version: z.number().int().nonnegative(),
});
export type ElementDeleteEvent = z.infer<typeof elementDeleteEventSchema>;

export const selectionUpdateEventSchema = z.object({
  boardId: boardIdSchema,
  userId: z.string().uuid(),
  selectedIds: z.array(z.string().min(1).max(128)).max(SELECTION_IDS_MAX),
});
export type SelectionUpdateEvent = z.infer<typeof selectionUpdateEventSchema>;

export const boardDataPayloadSchema = z.object({
  boardId: boardIdSchema,
  role: boardMemberRoleSchema,
  version: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  presence: z.array(presenceMemberSchema),
});
export type BoardDataPayload = z.infer<typeof boardDataPayloadSchema>;

export const kickPayloadSchema = z.object({
  boardId: boardIdSchema,
  reason: z.string().max(64),
});
export type KickPayload = z.infer<typeof kickPayloadSchema>;

export const boardDeletedPayloadSchema = z.object({
  boardId: boardIdSchema,
  reason: z.string().max(64),
});
export type BoardDeletedPayload = z.infer<typeof boardDeletedPayloadSchema>;

/** Server -> client: a member started/stopped typing in a board. */
export const chatTypingEventSchema = z.object({
  boardId: boardIdSchema,
  userId: z.string().uuid(),
  isTyping: z.boolean(),
});
export type ChatTypingEvent = z.infer<typeof chatTypingEventSchema>;

/** Server -> client: a member advanced their read receipt. */
export const chatReadEventSchema = z.object({
  boardId: boardIdSchema,
  userId: z.string().uuid(),
  lastReadMessageId: z.string().uuid(),
  readAt: z.string(),
});
export type ChatReadEvent = z.infer<typeof chatReadEventSchema>;

/** A persisted chat message, as returned by the chat REST API. */
export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  boardId: boardIdSchema,
  authorId: z.string().uuid(),
  body: z.string().nullable(),
  attachmentUrl: z.string().max(2048).nullable(),
  createdAt: z.string(),
  author: z.object({
    id: z.string().uuid(),
    name: z.string().max(120).nullable(),
    avatarUrl: z.string().max(2048).nullable(),
  }),
});
export type ChatMessageEvent = z.infer<typeof chatMessageSchema>;

/** Server -> client: a new chat message was persisted on the board. */
export const chatMessageEventSchema = z.object({
  boardId: boardIdSchema,
  message: chatMessageSchema,
});
export type ChatMessageEventPayload = z.infer<typeof chatMessageEventSchema>;

/** Server -> client: a comment was added to a thread on the board. */
export const commentCreatedEventSchema = z.object({
  boardId: boardIdSchema,
  threadId: z.string().uuid(),
  commentId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type CommentCreatedEvent = z.infer<typeof commentCreatedEventSchema>;

/** Server -> client: a thread was resolved or unresolved. */
export const commentResolvedEventSchema = z.object({
  boardId: boardIdSchema,
  threadId: z.string().uuid(),
  userId: z.string().uuid(),
  resolved: z.boolean(),
  resolvedAt: z.string().nullable(),
});
export type CommentResolvedEvent = z.infer<typeof commentResolvedEventSchema>;

/** Server -> client: a new in-app notification for the targeted user. */
export const notificationNewEventSchema = z.object({
  notificationId: z.string().uuid(),
  type: z.string().min(1).max(64),
  payload: z.record(z.string(), z.unknown()).nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type NotificationNewEvent = z.infer<typeof notificationNewEventSchema>;

// ---------------------------------------------------------------------------
// Ack data
// ---------------------------------------------------------------------------

export const joinAckDataSchema = z.object({
  boardId: boardIdSchema,
  role: boardMemberRoleSchema,
});
export type JoinAckData = z.infer<typeof joinAckDataSchema>;

export const leaveAckDataSchema = z.object({
  boardId: boardIdSchema,
});
export type LeaveAckData = z.infer<typeof leaveAckDataSchema>;

export const presenceUpdateAckDataSchema = z.object({
  activity: presenceActivitySchema,
  tool: z.string().max(64).nullable(),
});
export type PresenceUpdateAckData = z.infer<typeof presenceUpdateAckDataSchema>;

export const cursorMoveAckDataSchema = z.object({
  dropped: z.boolean(),
});
export type CursorMoveAckData = z.infer<typeof cursorMoveAckDataSchema>;

export const drawPatchAckDataSchema = z.object({
  id: z.string().min(1).max(128),
  version: z.number().int().nonnegative(),
});
export type DrawPatchAckData = z.infer<typeof drawPatchAckDataSchema>;

export const elementAckDataSchema = drawPatchAckDataSchema;
export type ElementAckData = z.infer<typeof elementAckDataSchema>;

export const selectionUpdateAckDataSchema = z.object({
  selectedIds: z.array(z.string().min(1).max(128)).max(SELECTION_IDS_MAX),
});
export type SelectionUpdateAckData = z.infer<
  typeof selectionUpdateAckDataSchema
>;

export const presenceRosterAckDataSchema = z.object({
  presence: z.array(presenceMemberSchema),
});
export type PresenceRosterAckData = z.infer<typeof presenceRosterAckDataSchema>;

export const chatTypingAckDataSchema = z.object({
  throttled: z.boolean(),
});
export type ChatTypingAckData = z.infer<typeof chatTypingAckDataSchema>;

export const chatReadAckDataSchema = z.object({
  lastReadMessageId: z.string().uuid(),
  readAt: z.string(),
});
export type ChatReadAckData = z.infer<typeof chatReadAckDataSchema>;

export type { PresenceActivity };
