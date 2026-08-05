import { Inject, Injectable, forwardRef } from '@nestjs/common';
import {
  PRESENCE_ACTIVITY,
  SOCKET_EVENTS,
  boardRoom,
  userRoom,
  type BoardDataPayload,
  type BoardDeletedPayload,
  type BoardMemberRole,
  type BoardRestoredEvent,
  type BoardRevisionEvent,
  type ChatReadAckData,
  type ChatReadEvent,
  type ChatReadPayload,
  type ChatTypingAckData,
  type ChatTypingEvent,
  type ChatTypingPayload,
  type ChatMessageEvent,
  type ChatMessageEventPayload,
  type CommentCreatedEvent,
  type CommentResolvedEvent,
  type CursorMoveAckData,
  type CursorMoveEvent,
  type CursorMovePayload,
  type DrawPatchAckData,
  type DrawPatchEvent,
  type DrawPatchPayload,
  type ElementAckData,
  type ElementCreateEvent,
  type ElementCreatePayload,
  type ElementDeleteEvent,
  type ElementDeletePayload,
  type JoinAckData,
  type JoinBoardPayload,
  type KickPayload,
  type LeaveAckData,
  type LeaveBoardPayload,
  type NotificationNewEvent,
  type PresenceMember,
  type PresenceRosterPayload,
  type PresenceUpdateAckData,
  type PresenceUpdateEvent,
  type PresenceUpdatePayload,
  type SelectionUpdateAckData,
  type SelectionUpdateEvent,
  type SelectionUpdatePayload,
  type SocketError,
} from '@whiteboard/shared';
import type { BroadcastOperator, DefaultEventsMap, Server } from 'socket.io';
import { BOARD_ROLE_RANK } from '../boards/board.constants';
import { BoardRepository } from '../boards/board.repository';
import { MemberRepository } from '../boards/member.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import type { AccessTokenVerified } from '../auth/auth-token.service';
import { ChatService } from '../chat/chat.service';
import { PresenceService } from './presence.service';
import {
  boardNotFoundError,
  chatMessageNotFoundError,
  forbiddenError,
  notAMemberError,
  notJoinedError,
  staleVersionError,
} from './realtime.errors';
import { REALTIME_CONFIG, type RealtimeConfig } from './realtime.constants';

export interface RealtimeSocketData {
  user: AccessTokenVerified;
  boardId?: string;
  role?: BoardMemberRole;
}

/**
 * Structural view of a Socket.IO socket that the service depends on, kept
 * narrow so unit tests can drive it without a real network connection.
 */
export interface RealtimeSocketContext {
  id: string;
  data: RealtimeSocketData;
  join(room: string, callback?: (err?: unknown) => void): void;
  leave(room: string): void;
  emit(event: string, ...args: unknown[]): void;
  disconnect(close?: boolean): void;
  to(room: string): BroadcastOperator<DefaultEventsMap, unknown>;
}

@Injectable()
export class RealtimeService {
  private readonly cursorSentAt = new WeakMap<RealtimeSocketContext, number>();
  private readonly cursorQueued = new WeakMap<
    RealtimeSocketContext,
    CursorMovePayload
  >();
  private readonly typingSentAt = new WeakMap<RealtimeSocketContext, number>();
  private server: Server | null = null;

  constructor(
    private readonly presenceService: PresenceService,
    @Inject(REALTIME_CONFIG) private readonly config: RealtimeConfig,
    @Inject(forwardRef(() => MemberRepository))
    private readonly memberRepository: MemberRepository,
    @Inject(forwardRef(() => BoardRepository))
    private readonly boardRepository: BoardRepository,
    private readonly userRepository: UserRepository,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  attachServer(server: Server): void {
    this.server = server;
  }

  async join(
    socket: RealtimeSocketContext,
    payload: JoinBoardPayload,
  ): Promise<JoinAckData | SocketError> {
    const room = boardRoom(payload.boardId);

    if (socket.data.boardId === payload.boardId) {
      return { boardId: payload.boardId, role: socket.data.role ?? 'VIEWER' };
    }

    const [board, membership] = await Promise.all([
      this.boardRepository.findById(payload.boardId),
      this.memberRepository.findMembership(
        payload.boardId,
        socket.data.user.userId,
      ),
    ]);

    if (board === null || board.deletedAt !== null) {
      return boardNotFoundError();
    }
    if (membership === null) {
      return notAMemberError();
    }

    const previousBoardId = socket.data.boardId;
    if (previousBoardId !== undefined) {
      await this.leaveRoom(socket, previousBoardId);
    }

    socket.data.boardId = payload.boardId;
    socket.data.role = membership.role;
    socket.join(room);

    const user = await this.userRepository.findById(socket.data.user.userId);
    await this.presenceService.setPresence({
      boardId: payload.boardId,
      socketId: socket.id,
      userId: socket.data.user.userId,
      name: user?.name ?? null,
      avatarUrl: user?.avatarUrl ?? null,
      role: membership.role,
    });

    const roster = await this.presenceService.listBoard(payload.boardId);
    socket.to(room).emit(SOCKET_EVENTS.PRESENCE_ROSTER, rosterEvent(roster));

    const snapshot: BoardDataPayload = {
      boardId: payload.boardId,
      role: membership.role,
      version: String(board.updatedAt.getTime()),
      revision: board.revision,
      data: toBoardData(board.data),
      presence: roster,
    };
    socket.emit(SOCKET_EVENTS.BOARD_DATA, snapshot);

    return { boardId: payload.boardId, role: membership.role };
  }

  async leave(
    socket: RealtimeSocketContext,
    payload: LeaveBoardPayload,
  ): Promise<LeaveAckData | SocketError> {
    if (socket.data.boardId !== payload.boardId) {
      return notJoinedError();
    }
    await this.leaveRoom(socket, payload.boardId);
    return { boardId: payload.boardId };
  }

  async handleDisconnect(socket: RealtimeSocketContext): Promise<void> {
    const boardId = socket.data.boardId;
    if (boardId === undefined) {
      return;
    }
    socket.data.boardId = undefined;
    socket.data.role = undefined;
    await this.presenceService.removeSocket(
      boardId,
      socket.id,
      socket.data.user.userId,
    );
    await this.broadcastRoster(socket, boardId);
  }

  async updatePresence(
    socket: RealtimeSocketContext,
    payload: PresenceUpdatePayload,
  ): Promise<PresenceUpdateAckData | SocketError> {
    const boardId = socket.data.boardId;
    if (boardId === undefined) {
      return notJoinedError();
    }

    const member = await this.presenceService.updateStatus(boardId, socket.id, {
      activity: payload.activity ?? PRESENCE_ACTIVITY.ONLINE,
      tool: payload.tool ?? null,
    });
    if (member === null) {
      return notJoinedError();
    }

    const event: PresenceUpdateEvent = {
      userId: member.userId,
      presence: { activity: member.activity, tool: member.tool },
    };
    socket.to(boardRoom(boardId)).emit(SOCKET_EVENTS.PRESENCE_UPDATE, event);
    return { activity: member.activity, tool: member.tool };
  }

  moveCursor(
    socket: RealtimeSocketContext,
    payload: CursorMovePayload,
  ): CursorMoveAckData | SocketError {
    const boardId = this.joinedBoardId(socket, payload.boardId);
    if (boardId === null) {
      return this.boardErrorFor(socket, payload.boardId);
    }

    const now = Date.now();
    const lastSent = this.cursorSentAt.get(socket) ?? 0;
    if (now - lastSent < this.config.cursorMinIntervalMs) {
      this.cursorQueued.set(socket, payload);
      return { dropped: true };
    }

    const toSend = this.cursorQueued.get(socket) ?? payload;
    this.cursorQueued.delete(socket);
    this.cursorSentAt.set(socket, now);

    const event: CursorMoveEvent = {
      boardId,
      userId: socket.data.user.userId,
      x: toSend.x,
      y: toSend.y,
    };
    socket.to(boardRoom(boardId)).emit(SOCKET_EVENTS.CURSOR_MOVE, event);
    return { dropped: false };
  }

  async applyDrawPatch(
    socket: RealtimeSocketContext,
    payload: DrawPatchPayload,
  ): Promise<DrawPatchAckData | SocketError> {
    const boardId = this.requireJoinedBoard(socket, payload.boardId);
    if (boardId === null) {
      return this.boardErrorFor(socket, payload.boardId);
    }
    const editorError = this.requireEditor(socket);
    if (editorError !== null) {
      return editorError;
    }

    const accepted = await this.presenceService.acceptVersion(
      boardId,
      payload.id,
      payload.version,
    );
    if (!accepted) {
      return staleVersionError(payload.id, payload.version);
    }

    const event: DrawPatchEvent = {
      boardId,
      userId: socket.data.user.userId,
      id: payload.id,
      patch: payload.patch,
      version: payload.version,
      timestamp: payload.timestamp,
    };
    socket.to(boardRoom(boardId)).emit(SOCKET_EVENTS.DRAW_PATCH, event);
    return { id: payload.id, version: payload.version };
  }

  async createElement(
    socket: RealtimeSocketContext,
    payload: ElementCreatePayload,
  ): Promise<ElementAckData | SocketError> {
    const boardId = this.requireJoinedBoard(socket, payload.boardId);
    if (boardId === null) {
      return this.boardErrorFor(socket, payload.boardId);
    }
    const editorError = this.requireEditor(socket);
    if (editorError !== null) {
      return editorError;
    }

    const accepted = await this.presenceService.acceptVersion(
      boardId,
      payload.element.id,
      payload.element.version,
    );
    if (!accepted) {
      return staleVersionError(payload.element.id, payload.element.version);
    }

    const event: ElementCreateEvent = {
      boardId,
      userId: socket.data.user.userId,
      element: payload.element,
    };
    socket.to(boardRoom(boardId)).emit(SOCKET_EVENTS.ELEMENT_CREATE, event);
    return { id: payload.element.id, version: payload.element.version };
  }

  async deleteElement(
    socket: RealtimeSocketContext,
    payload: ElementDeletePayload,
  ): Promise<ElementAckData | SocketError> {
    const boardId = this.requireJoinedBoard(socket, payload.boardId);
    if (boardId === null) {
      return this.boardErrorFor(socket, payload.boardId);
    }
    const editorError = this.requireEditor(socket);
    if (editorError !== null) {
      return editorError;
    }

    const accepted = await this.presenceService.acceptVersion(
      boardId,
      payload.id,
      payload.version,
    );
    if (!accepted) {
      return staleVersionError(payload.id, payload.version);
    }

    const event: ElementDeleteEvent = {
      boardId,
      userId: socket.data.user.userId,
      id: payload.id,
      version: payload.version,
    };
    socket.to(boardRoom(boardId)).emit(SOCKET_EVENTS.ELEMENT_DELETE, event);
    return { id: payload.id, version: payload.version };
  }

  updateSelection(
    socket: RealtimeSocketContext,
    payload: SelectionUpdatePayload,
  ): SelectionUpdateAckData | SocketError {
    const boardId = this.requireJoinedBoard(socket, payload.boardId);
    if (boardId === null) {
      return this.boardErrorFor(socket, payload.boardId);
    }

    const event: SelectionUpdateEvent = {
      boardId,
      userId: socket.data.user.userId,
      selectedIds: payload.selectedIds,
    };
    socket.to(boardRoom(boardId)).emit(SOCKET_EVENTS.SELECTION_UPDATE, event);
    return { selectedIds: payload.selectedIds };
  }

  /**
   * Relays a typing indicator to the board room. Broadcasts are throttled per
   * socket by `chatTypingThrottleMs`; excess updates are dropped (`throttled`).
   */
  chatTyping(
    socket: RealtimeSocketContext,
    payload: ChatTypingPayload,
  ): ChatTypingAckData | SocketError {
    const boardId = this.joinedBoardId(socket, payload.boardId);
    if (boardId === null) {
      return this.boardErrorFor(socket, payload.boardId);
    }

    const now = Date.now();
    const lastSent = this.typingSentAt.get(socket) ?? 0;
    if (now - lastSent < this.config.chatTypingThrottleMs) {
      return { throttled: true };
    }
    this.typingSentAt.set(socket, now);

    const event: ChatTypingEvent = {
      boardId,
      userId: socket.data.user.userId,
      isTyping: payload.isTyping,
    };
    socket.to(boardRoom(boardId)).emit(SOCKET_EVENTS.CHAT_TYPING, event);
    return { throttled: false };
  }

  /**
   * Persists the caller's read receipt for a chat message and relays it to the
   * board room so peers can show read state.
   */
  async chatRead(
    socket: RealtimeSocketContext,
    payload: ChatReadPayload,
  ): Promise<ChatReadAckData | SocketError> {
    const boardId = this.joinedBoardId(socket, payload.boardId);
    if (boardId === null) {
      return this.boardErrorFor(socket, payload.boardId);
    }

    const receipt = await this.chatService.recordReadReceipt(
      boardId,
      socket.data.user.userId,
      payload.lastReadMessageId,
    );
    if (receipt === null) {
      return chatMessageNotFoundError();
    }

    const event: ChatReadEvent = {
      boardId,
      userId: socket.data.user.userId,
      lastReadMessageId: receipt.lastReadMessageId,
      readAt: receipt.lastReadAt.toISOString(),
    };
    socket.to(boardRoom(boardId)).emit(SOCKET_EVENTS.CHAT_READ, event);
    return {
      lastReadMessageId: receipt.lastReadMessageId,
      readAt: receipt.lastReadAt.toISOString(),
    };
  }

  /** Broadcasts a newly persisted chat message to a board room. */
  broadcastChatMessage(boardId: string, message: ChatMessageEvent): void {
    const server = this.server;
    if (server === null) {
      return;
    }
    const event: ChatMessageEventPayload = { boardId, message };
    server.to(boardRoom(boardId)).emit(SOCKET_EVENTS.CHAT_MESSAGE, event);
  }

  /** Broadcasts a persisted save so peers can advance their autosave base revision. */
  broadcastRevision(boardId: string, revision: number): void {
    const server = this.server;
    if (server === null) {
      return;
    }
    const event: BoardRevisionEvent = { boardId, revision };
    server.to(boardRoom(boardId)).emit(SOCKET_EVENTS.BOARD_REVISION, event);
  }

  /** Broadcasts the authoritative document after a restore so all clients re-sync. */
  broadcastBoardRestored(boardId: string, event: BoardRestoredEvent): void {
    const server = this.server;
    if (server === null) {
      return;
    }
    server.to(boardRoom(boardId)).emit(SOCKET_EVENTS.BOARD_RESTORED, event);
  }

  /** Broadcasts a comment addition to a board room. */
  broadcastCommentCreated(boardId: string, event: CommentCreatedEvent): void {
    const server = this.server;
    if (server === null) {
      return;
    }
    server.to(boardRoom(boardId)).emit(SOCKET_EVENTS.COMMENT_CREATED, event);
  }

  /** Broadcasts a thread resolve/unresolve change to a board room. */
  broadcastCommentResolved(boardId: string, event: CommentResolvedEvent): void {
    const server = this.server;
    if (server === null) {
      return;
    }
    server.to(boardRoom(boardId)).emit(SOCKET_EVENTS.COMMENT_RESOLVED, event);
  }

  /** Delivers an in-app notification to all of a user's connected sockets. */
  emitNotification(userId: string, event: NotificationNewEvent): void {
    const server = this.server;
    if (server === null) {
      return;
    }
    server.to(userRoom(userId)).emit(SOCKET_EVENTS.NOTIFICATION_NEW, event);
  }

  async kick(boardId: string, userId: string, reason: string): Promise<void> {
    const found = await this.presenceService.findUser(userId);
    if (found === null || found.boardId !== boardId) {
      return;
    }
    const server = this.server;
    if (server === null) {
      return;
    }

    const payload: KickPayload = { boardId, reason };
    server.to(found.socketId).emit(SOCKET_EVENTS.KICK, payload);
    server.to(found.socketId).disconnectSockets(true);
    await this.presenceService.removeUser(userId);
  }

  async closeBoard(boardId: string, reason: string): Promise<void> {
    const server = this.server;
    if (server !== null) {
      const payload: BoardDeletedPayload = { boardId, reason };
      server.to(boardRoom(boardId)).emit(SOCKET_EVENTS.BOARD_DELETED, payload);
      server.to(boardRoom(boardId)).disconnectSockets(true);
    }
    await this.presenceService.clearBoard(boardId);
  }

  private async leaveRoom(
    socket: RealtimeSocketContext,
    boardId: string,
  ): Promise<void> {
    socket.leave(boardRoom(boardId));
    socket.data.boardId = undefined;
    socket.data.role = undefined;
    await this.presenceService.removeSocket(
      boardId,
      socket.id,
      socket.data.user.userId,
    );
    await this.broadcastRoster(socket, boardId);
  }

  private async broadcastRoster(
    socket: RealtimeSocketContext,
    boardId: string,
  ): Promise<void> {
    const roster = await this.presenceService.listBoard(boardId);
    if (roster.length === 0) {
      return;
    }
    socket
      .to(boardRoom(boardId))
      .emit(SOCKET_EVENTS.PRESENCE_ROSTER, rosterEvent(roster));
  }

  private joinedBoardId(
    socket: RealtimeSocketContext,
    payloadBoardId: string,
  ): string | null {
    if (socket.data.boardId === undefined) {
      return null;
    }
    if (socket.data.boardId !== payloadBoardId) {
      return null;
    }
    return socket.data.boardId;
  }

  private requireJoinedBoard(
    socket: RealtimeSocketContext,
    payloadBoardId: string,
  ): string | null {
    return this.joinedBoardId(socket, payloadBoardId);
  }

  private boardErrorFor(
    socket: RealtimeSocketContext,
    payloadBoardId: string,
  ): SocketError {
    if (socket.data.boardId === undefined) {
      return notJoinedError();
    }
    if (socket.data.boardId !== payloadBoardId) {
      return forbiddenError('Socket is not joined to this board');
    }
    return notJoinedError();
  }

  private requireEditor(socket: RealtimeSocketContext): SocketError | null {
    const role = socket.data.role;
    if (role !== undefined && BOARD_ROLE_RANK[role] >= BOARD_ROLE_RANK.EDITOR) {
      return null;
    }
    return forbiddenError('Only editors can modify elements');
  }
}

function rosterEvent(roster: PresenceMember[]): PresenceRosterPayload {
  return { presence: roster };
}

function toBoardData(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
