import {
  BOARD_NAMESPACE,
  SOCKET_EVENTS,
  type BoardDataPayload,
  type BoardDeletedPayload,
  type ChatMessageEventPayload,
  type ChatReadEvent,
  type ChatTypingEvent,
  type CommentCreatedEvent,
  type CommentResolvedEvent,
  type CursorMoveEvent,
  type DrawPatchEvent,
  type ElementCreateEvent,
  type ElementDeleteEvent,
  type KickPayload,
  type NotificationNewEvent,
  type PresenceRosterPayload,
  type PresenceUpdateEvent,
  type SelectionUpdateEvent,
  type SocketAck,
} from '@whiteboard/shared';
import { getApiBaseUrl } from '@/lib/api/http-client';
import { useRealtimeStore } from '@/stores/realtime-store';
import { io, type Socket } from 'socket.io-client';

/** Server -> client events in the `/boards` namespace (shared contract). */
export interface RealtimeServerEventMap {
  [SOCKET_EVENTS.BOARD_DATA]: (payload: BoardDataPayload) => void;
  [SOCKET_EVENTS.PRESENCE_ROSTER]: (payload: PresenceRosterPayload) => void;
  [SOCKET_EVENTS.PRESENCE_UPDATE]: (payload: PresenceUpdateEvent) => void;
  [SOCKET_EVENTS.CURSOR_MOVE]: (payload: CursorMoveEvent) => void;
  [SOCKET_EVENTS.DRAW_PATCH]: (payload: DrawPatchEvent) => void;
  [SOCKET_EVENTS.ELEMENT_CREATE]: (payload: ElementCreateEvent) => void;
  [SOCKET_EVENTS.ELEMENT_DELETE]: (payload: ElementDeleteEvent) => void;
  [SOCKET_EVENTS.SELECTION_UPDATE]: (payload: SelectionUpdateEvent) => void;
  [SOCKET_EVENTS.CHAT_MESSAGE]: (payload: ChatMessageEventPayload) => void;
  [SOCKET_EVENTS.CHAT_TYPING]: (payload: ChatTypingEvent) => void;
  [SOCKET_EVENTS.CHAT_READ]: (payload: ChatReadEvent) => void;
  [SOCKET_EVENTS.COMMENT_CREATED]: (payload: CommentCreatedEvent) => void;
  [SOCKET_EVENTS.COMMENT_RESOLVED]: (payload: CommentResolvedEvent) => void;
  [SOCKET_EVENTS.NOTIFICATION_NEW]: (payload: NotificationNewEvent) => void;
  [SOCKET_EVENTS.KICK]: (payload: KickPayload) => void;
  [SOCKET_EVENTS.BOARD_DELETED]: (payload: BoardDeletedPayload) => void;
}

/** Auth failures that require a fresh access token before retrying. */
export const REALTIME_AUTH_ERROR_CODES = new Set([
  'UNAUTHORIZED',
  'INVALID_TOKEN',
]);

type AuthErrorHandler = (code: string, message: string) => void;

const SOCKET_URL_ERROR = 'Failed to build the realtime server URL';

/**
 * Singleton Socket.IO client for the `/boards` namespace.
 *
 * Owns the connection lifecycle and mirrors `connecting`/`connected`/
 * `disconnected` into the realtime store. Authentication is performed at the
 * handshake via `auth.token`; `connect_error` acks with an auth error code are
 * forwarded to registered handlers so the app can refresh the token and
 * reconnect.
 */
class RealtimeClient {
  private socket: Socket | null = null;
  private readonly authErrorHandlers = new Set<AuthErrorHandler>();

  get isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }

  get isAvailable(): boolean {
    return this.socket !== null;
  }

  get socketId(): string | null {
    return this.socket?.id ?? null;
  }

  connect(token: string): void {
    if (this.socket !== null) {
      return;
    }
    const url = this.buildUrl();
    const socket: Socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      randomizationFactor: 0.5,
      timeout: 10_000,
    });
    this.socket = socket;

    socket.on('connect', () => {
      useRealtimeStore.getState().setConnectionStatus('connected');
    });
    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') {
        useRealtimeStore.getState().setConnectionStatus('disconnected');
        return;
      }
      useRealtimeStore.getState().setConnectionStatus('disconnected');
      useRealtimeStore.getState().clear();
    });
    socket.on('connect_error', (error) => {
      useRealtimeStore.getState().setConnectionStatus('connecting');
      const data = (error as Error & { data?: unknown }).data as
        { code?: unknown; message?: unknown } | undefined;
      const code = typeof data?.code === 'string' ? data.code : 'UNKNOWN';
      const message =
        typeof data?.message === 'string'
          ? data.message
          : 'Unable to connect to the realtime server';
      if (REALTIME_AUTH_ERROR_CODES.has(code)) {
        for (const handler of this.authErrorHandlers) {
          handler(code, message);
        }
      }
    });
  }

  /** Subscribes to a server -> client event. Returns an unsubscribe function. */
  on<Event extends keyof RealtimeServerEventMap>(
    event: Event,
    handler: RealtimeServerEventMap[Event],
  ): () => void {
    const socket = this.requireSocket();
    socket.on(event, handler as never);
    return () => {
      socket.off(event, handler as never);
    };
  }

  /** Emits a client -> server event with an optional ack callback. */
  emit<Payload, AckData = unknown>(
    event: string,
    payload: Payload,
    ack?: (result: SocketAck<AckData>) => void,
  ): void {
    const socket = this.socket;
    if (socket === null || !socket.connected) {
      return;
    }
    if (ack === undefined) {
      socket.emit(event, payload);
      return;
    }
    socket.emit(event, payload, (result: SocketAck<AckData>) => {
      ack(result);
    });
  }

  onAuthError(handler: AuthErrorHandler): () => void {
    this.authErrorHandlers.add(handler);
    return () => {
      this.authErrorHandlers.delete(handler);
    };
  }

  disconnect(): void {
    const socket = this.socket;
    this.socket = null;
    this.authErrorHandlers.clear();
    if (socket !== null) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    useRealtimeStore.getState().setConnectionStatus('disconnected');
    useRealtimeStore.getState().clear();
  }

  private requireSocket(): Socket {
    const socket = this.socket;
    if (socket === null) {
      throw new Error(SOCKET_URL_ERROR);
    }
    return socket;
  }

  private buildUrl(): string {
    const base = getApiBaseUrl();
    let origin: string;
    try {
      origin = new URL(base).origin;
    } catch {
      throw new Error(SOCKET_URL_ERROR);
    }
    return `${origin}${BOARD_NAMESPACE}`;
  }
}

export const realtimeClient = new RealtimeClient();
