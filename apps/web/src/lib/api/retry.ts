import type { HttpMethod } from './types';

export interface RetryOptions {
  /** Number of retries after the initial attempt. */
  maxRetries: number;
  /** Base delay (ms) for the first retry. */
  baseDelayMs: number;
  /** Upper bound for any single backoff delay (ms). */
  maxDelayMs: number;
  /** Jitter ratio (0..1) added to each computed delay. */
  jitter: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 300,
  maxDelayMs: 4_000,
  jitter: 0.25,
};

/** HTTP methods that are safe to retry after a 5xx response. */
const IDEMPOTENT_METHODS: ReadonlySet<HttpMethod> = new Set<HttpMethod>([
  'GET',
  'HEAD',
  'OPTIONS',
]);

/** HTTP status codes that may indicate a transient server-side failure. */
const RETRYABLE_STATUS_CODES: ReadonlySet<number> = new Set<number>([
  408, 425, 429, 500, 502, 503, 504,
]);

export function isIdempotentMethod(method: HttpMethod): boolean {
  return IDEMPOTENT_METHODS.has(method);
}

/** Whether a failed response should be retried given the method and status. */
export function shouldRetry(status: number, method: HttpMethod): boolean {
  if (!RETRYABLE_STATUS_CODES.has(status)) {
    return false;
  }
  if (status === 429) {
    return true;
  }
  return isIdempotentMethod(method);
}

/**
 * Exponential backoff with jitter: `baseDelayMs * 2^attempt` bounded by
 * `maxDelayMs`, then uniformly jittered within `1 ± jitter`.
 */
export function computeRetryDelayMs(
  attempt: number,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): number {
  const exponential = Math.min(
    options.maxDelayMs,
    options.baseDelayMs * 2 ** Math.max(0, attempt - 1),
  );
  const spread = exponential * options.jitter;
  const jittered = exponential - spread + Math.random() * (spread * 2);
  return Math.max(0, Math.min(options.maxDelayMs, Math.round(jittered)));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
