export const AUTH_RATE_LIMIT = parseInt(process.env.AUTH_RATE_LIMIT ?? '5', 10);
export const AUTH_RATE_LIMIT_TTL_MS = parseInt(
  process.env.AUTH_RATE_LIMIT_TTL_MS ?? '60000',
  10,
);
export const DEVICE_MAX_LENGTH = 512;
