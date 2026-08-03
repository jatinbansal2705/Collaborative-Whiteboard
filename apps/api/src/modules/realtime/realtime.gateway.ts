import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  BOARD_NAMESPACE,
  SOCKET_ERROR_CODES,
  SOCKET_EVENTS,
  ackError,
  ackOk,
  chatReadPayloadSchema,
  chatTypingPayloadSchema,
  cursorMovePayloadSchema,
  drawPatchPayloadSchema,
  elementCreatePayloadSchema,
  elementDeletePayloadSchema,
  joinBoardPayloadSchema,
  leaveBoardPayloadSchema,
  presenceUpdatePayloadSchema,
  selectionUpdatePayloadSchema,
  userRoom,
  validateSocketPayload,
  type ChatReadAckData,
  type ChatTypingAckData,
  type JoinAckData,
  type LeaveAckData,
  type PresenceUpdateAckData,
  type SelectionUpdateAckData,
  type SocketAck,
  type SocketError,
  type SocketErrorCode,
} from '@whiteboard/shared';
import { TokenService } from '../auth/auth-token.service';
import {
  RealtimeService,
  type RealtimeSocketContext,
  type RealtimeSocketData,
} from './realtime.service';

/**
 * Socket.IO gateway for the `/boards` namespace. Every client event is
 * validated against the shared contract and answered with a SocketAck
 * (`{ ok: true, data }` or `{ ok: false, error: { code, message } }`).
 *
 * Authentication happens at the connection handshake: the access token is
 * read from `auth.token` (or the `Authorization: Bearer` header) and verified
 * with TokenService. Rejected sockets receive a `connect_error` carrying the
 * same ack envelope and are disconnected.
 */
@WebSocketGateway({
  namespace: BOARD_NAMESPACE,
})
@Injectable()
export class RealtimeGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtimeService.attachServer(server);
    server.use((socket, next) => {
      void this.authenticate(socket)
        .then(() => {
          next();
        })
        .catch((error: unknown) => {
          next(this.toConnectionError(error));
        });
    });
  }

  handleDisconnect(socket: Socket): void {
    void this.realtimeService.handleDisconnect(this.toContext(socket));
  }

  private async authenticate(socket: Socket): Promise<void> {
    const token = this.extractToken(socket);
    if (token === null) {
      throw new ConnectionError(
        SOCKET_ERROR_CODES.UNAUTHORIZED,
        'Authentication required',
      );
    }
    const user = await this.tokenService.verifyAccessToken(token);
    (socket.data as RealtimeSocketData).user = user;
    await socket.join(userRoom(user.userId));
  }

  private toConnectionError(error: unknown): Error {
    if (error instanceof ConnectionError) {
      return error;
    }
    return new ConnectionError(
      SOCKET_ERROR_CODES.INVALID_TOKEN,
      'Invalid or expired access token',
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN)
  async onJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
  ): Promise<SocketAck<JoinAckData>> {
    const parsed = validateSocketPayload(joinBoardPayloadSchema, payload);
    if (!parsed.ok) {
      return ackError(parsed.error.code, parsed.error.message);
    }
    return this.toAck(
      await this.realtimeService.join(this.toContext(socket), parsed.value),
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE)
  async onLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
  ): Promise<SocketAck<LeaveAckData>> {
    const parsed = validateSocketPayload(leaveBoardPayloadSchema, payload);
    if (!parsed.ok) {
      return ackError(parsed.error.code, parsed.error.message);
    }
    return this.toAck(
      await this.realtimeService.leave(this.toContext(socket), parsed.value),
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.PRESENCE_UPDATE)
  async onPresenceUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
  ): Promise<SocketAck<PresenceUpdateAckData>> {
    const parsed = validateSocketPayload(presenceUpdatePayloadSchema, payload);
    if (!parsed.ok) {
      return ackError(parsed.error.code, parsed.error.message);
    }
    return this.toAck(
      await this.realtimeService.updatePresence(
        this.toContext(socket),
        parsed.value,
      ),
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.CURSOR_MOVE)
  onCursorMove(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
  ): SocketAck<{ dropped: boolean }> {
    const parsed = validateSocketPayload(cursorMovePayloadSchema, payload);
    if (!parsed.ok) {
      return ackError(parsed.error.code, parsed.error.message);
    }
    return this.toAck(
      this.realtimeService.moveCursor(this.toContext(socket), parsed.value),
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.DRAW_PATCH)
  async onDrawPatch(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
  ): Promise<SocketAck<{ id: string; version: number }>> {
    const parsed = validateSocketPayload(drawPatchPayloadSchema, payload);
    if (!parsed.ok) {
      return ackError(parsed.error.code, parsed.error.message);
    }
    return this.toAck(
      await this.realtimeService.applyDrawPatch(
        this.toContext(socket),
        parsed.value,
      ),
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.ELEMENT_CREATE)
  async onElementCreate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
  ): Promise<SocketAck<{ id: string; version: number }>> {
    const parsed = validateSocketPayload(elementCreatePayloadSchema, payload);
    if (!parsed.ok) {
      return ackError(parsed.error.code, parsed.error.message);
    }
    return this.toAck(
      await this.realtimeService.createElement(
        this.toContext(socket),
        parsed.value,
      ),
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.ELEMENT_DELETE)
  async onElementDelete(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
  ): Promise<SocketAck<{ id: string; version: number }>> {
    const parsed = validateSocketPayload(elementDeletePayloadSchema, payload);
    if (!parsed.ok) {
      return ackError(parsed.error.code, parsed.error.message);
    }
    return this.toAck(
      await this.realtimeService.deleteElement(
        this.toContext(socket),
        parsed.value,
      ),
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.SELECTION_UPDATE)
  onSelectionUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
  ): SocketAck<SelectionUpdateAckData> {
    const parsed = validateSocketPayload(selectionUpdatePayloadSchema, payload);
    if (!parsed.ok) {
      return ackError(parsed.error.code, parsed.error.message);
    }
    return this.toAck(
      this.realtimeService.updateSelection(
        this.toContext(socket),
        parsed.value,
      ),
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.CHAT_TYPING)
  onChatTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
  ): SocketAck<ChatTypingAckData> {
    const parsed = validateSocketPayload(chatTypingPayloadSchema, payload);
    if (!parsed.ok) {
      return ackError(parsed.error.code, parsed.error.message);
    }
    return this.toAck(
      this.realtimeService.chatTyping(this.toContext(socket), parsed.value),
    );
  }

  @SubscribeMessage(SOCKET_EVENTS.CHAT_READ)
  async onChatRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
  ): Promise<SocketAck<ChatReadAckData>> {
    const parsed = validateSocketPayload(chatReadPayloadSchema, payload);
    if (!parsed.ok) {
      return ackError(parsed.error.code, parsed.error.message);
    }
    return this.toAck(
      await this.realtimeService.chatRead(this.toContext(socket), parsed.value),
    );
  }

  private extractToken(socket: Socket): string | null {
    const handshakeAuth = socket.handshake.auth as { token?: unknown };
    if (
      typeof handshakeAuth.token === 'string' &&
      handshakeAuth.token.length > 0
    ) {
      return handshakeAuth.token;
    }
    const authorization = socket.handshake.headers.authorization;
    if (
      typeof authorization === 'string' &&
      authorization.startsWith('Bearer ')
    ) {
      return authorization.slice('Bearer '.length);
    }
    return null;
  }

  private toContext(socket: Socket): RealtimeSocketContext {
    return socket as RealtimeSocketContext;
  }

  private toAck<T>(result: T | SocketError): SocketAck<T> {
    if (isSocketError(result)) {
      return ackError(result.code, result.message);
    }
    return ackOk(result);
  }
}

function isSocketError(value: unknown): value is SocketError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'code' in value && typeof value.code === 'string';
}

class ConnectionError extends Error {
  readonly data: {
    ok: false;
    error: { code: SocketErrorCode; message: string };
  };

  constructor(code: SocketErrorCode, message: string) {
    super(message);
    this.data = { ok: false, error: { code, message } };
  }
}
