import { describe, expect, it } from 'vitest';
import {
  computeRetryDelayMs,
  DEFAULT_RETRY_OPTIONS,
  isIdempotentMethod,
  shouldRetry,
} from '@/lib/api/retry';

describe('isIdempotentMethod', () => {
  it('treats GET, HEAD and OPTIONS as idempotent', () => {
    expect(isIdempotentMethod('GET')).toBe(true);
    expect(isIdempotentMethod('HEAD')).toBe(true);
    expect(isIdempotentMethod('OPTIONS')).toBe(true);
  });

  it('treats mutations as non-idempotent', () => {
    expect(isIdempotentMethod('POST')).toBe(false);
    expect(isIdempotentMethod('PUT')).toBe(false);
    expect(isIdempotentMethod('PATCH')).toBe(false);
    expect(isIdempotentMethod('DELETE')).toBe(false);
  });
});

describe('shouldRetry', () => {
  it('retries 5xx only for idempotent methods', () => {
    expect(shouldRetry(500, 'GET')).toBe(true);
    expect(shouldRetry(503, 'HEAD')).toBe(true);
    expect(shouldRetry(504, 'OPTIONS')).toBe(true);
    expect(shouldRetry(500, 'POST')).toBe(false);
  });

  it('always retries 429 and 408', () => {
    expect(shouldRetry(429, 'POST')).toBe(true);
    expect(shouldRetry(408, 'GET')).toBe(true);
    expect(shouldRetry(408, 'DELETE')).toBe(false);
  });

  it('never retries 4xx client errors', () => {
    expect(shouldRetry(400, 'GET')).toBe(false);
    expect(shouldRetry(404, 'GET')).toBe(false);
  });
});

describe('computeRetryDelayMs', () => {
  const options = { ...DEFAULT_RETRY_OPTIONS, jitter: 0 };

  it('scales exponentially from the base delay', () => {
    expect(computeRetryDelayMs(1, options)).toBe(options.baseDelayMs);
    expect(computeRetryDelayMs(2, options)).toBe(options.baseDelayMs * 2);
    expect(computeRetryDelayMs(3, options)).toBe(options.baseDelayMs * 4);
  });

  it('caps at maxDelayMs', () => {
    expect(computeRetryDelayMs(10, options)).toBe(options.maxDelayMs);
  });

  it('never returns a negative delay with jitter', () => {
    const jittered = { ...DEFAULT_RETRY_OPTIONS, jitter: 1 };
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const delay = computeRetryDelayMs(attempt, jittered);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(jittered.maxDelayMs);
    }
  });
});
