export const AUTH_RATE_LIMIT = parseInt(process.env.AUTH_RATE_LIMIT ?? '5', 10);
export const AUTH_RATE_LIMIT_TTL_MS = parseInt(
  process.env.AUTH_RATE_LIMIT_TTL_MS ?? '60000',
  10,
);
export const FORGOT_RATE_LIMIT = parseInt(
  process.env.AUTH_FORGOT_RATE_LIMIT ?? '3',
  10,
);
export const FORGOT_RATE_LIMIT_TTL_MS = 3_600_000;
export const RESEND_RATE_LIMIT = parseInt(
  process.env.AUTH_RESEND_RATE_LIMIT ?? '1',
  10,
);
export const RESEND_RATE_LIMIT_TTL_MS = 60_000;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60_000;
export const DEVICE_MAX_LENGTH = 512;
export const OAUTH_STATE_COOKIE = 'whiteboard_oauth_state';
export const OAUTH_STATE_MAX_AGE_MS = 10 * 60_000;
