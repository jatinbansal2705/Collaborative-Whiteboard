/**
 * Socket.IO event contract for the `/boards` namespace.
 *
 * Events are named `domain:action`. The server acknowledges every client
 * event with `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.
 * Broadcast strategy per event:
 *  - `board:join` / `board:leave`     -> ack + `board:data` (joiner) + `presence:roster` (room)
 *  - `presence:update`                -> `presence:update` broadcast (room, excluding sender)
 *  - `cursor:move`                    -> `cursor:move` broadcast (room, excluding sender, throttled)
 *  - `draw:patch`                     -> `draw:patch` broadcast (room, excluding sender)
 *  - `element:create` / `element:delete` -> same-named broadcast (room, excluding sender)
 *  - `selection:update`               -> `selection:update` broadcast (room, excluding sender)
 *  - `kick`                           -> targeted socket, then disconnect
 *  - `board:deleted`                  -> room broadcast, then disconnect
 */
export const BOARD_NAMESPACE = '/boards';

export const BOARD_ROOM_PREFIX = 'board:';

export const boardRoom = (boardId: string): string =>
  `${BOARD_ROOM_PREFIX}${boardId}`;

export const SOCKET_EVENTS = {
  JOIN: 'board:join',
  LEAVE: 'board:leave',
  PRESENCE_UPDATE: 'presence:update',
  PRESENCE_ROSTER: 'presence:roster',
  CURSOR_MOVE: 'cursor:move',
  DRAW_PATCH: 'draw:patch',
  ELEMENT_CREATE: 'element:create',
  ELEMENT_DELETE: 'element:delete',
  SELECTION_UPDATE: 'selection:update',
  BOARD_DATA: 'board:data',
  KICK: 'kick',
  BOARD_DELETED: 'board:deleted',
} as const;

export type SocketEventName =
  (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

/** Presence activities a member can report. */
export const PRESENCE_ACTIVITY = {
  ONLINE: 'online',
  AWAY: 'away',
  IDLE: 'idle',
} as const;

export type PresenceActivity =
  (typeof PRESENCE_ACTIVITY)[keyof typeof PRESENCE_ACTIVITY];

/** Stable socket error codes returned in `{ ok: false, error }` acks. */
export const SOCKET_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  BOARD_NOT_FOUND: 'BOARD_NOT_FOUND',
  NOT_A_MEMBER: 'NOT_A_MEMBER',
  NOT_JOINED: 'NOT_JOINED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  STALE_VERSION: 'STALE_VERSION',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  KICKED: 'KICKED',
  BOARD_DELETED: 'BOARD_DELETED',
} as const;

export type SocketErrorCode =
  (typeof SOCKET_ERROR_CODES)[keyof typeof SOCKET_ERROR_CODES];

export const SELECTION_IDS_MAX = 500;
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 30_000;
