export const REALTIME_CONFIG = 'REALTIME_CONFIG';

export interface RealtimeConfig {
  /** How long a presence entry lives without a heartbeat (ms). */
  presenceTtlMs: number;
  /** Minimum interval between cursor broadcasts per socket (ms). */
  cursorMinIntervalMs: number;
}

export const DEFAULT_PRESENCE_TTL_MS = 90_000;
export const DEFAULT_CURSOR_MIN_INTERVAL_MS = 25;

/** Reason sent to a socket when its membership was revoked. */
export const KICK_REASON_REMOVED = 'REMOVED';
/** Reason sent to a socket that left the board on its own. */
export const KICK_REASON_LEFT = 'LEFT';
/** Reason sent to every room member when the board is deleted. */
export const KICK_REASON_BOARD_DELETED = 'BOARD_DELETED';
