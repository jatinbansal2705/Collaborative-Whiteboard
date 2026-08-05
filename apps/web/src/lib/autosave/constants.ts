/** Debounce for autosave after the last canvas mutation (ADR-0005). */
export const AUTOSAVE_DEBOUNCE_MS = 1500;

/** Max conflict-merge retries per flush before surfacing an error. */
export const AUTOSAVE_MAX_RETRIES = 3;

/** Server error codes relevant to the autosave pipeline. */
export const BOARD_SERVER_ERROR_CODES = {
  STALE_BOARD_REVISION: 'STALE_BOARD_REVISION',
} as const;
