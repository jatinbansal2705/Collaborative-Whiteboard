/**
 * API envelope types matching the server contract (docs/PRD.md Part 6 and
 * ADR-0007). The API always responds with `{ success, data, meta }` on success
 * and `{ success: false, error: { code, message, details } }` on failure.
 */

export interface ApiErrorBody {
  code: string;
  message: string;
  details: unknown;
}

export interface ApiSuccessEnvelope<T, M = unknown> {
  success: true;
  data: T;
  meta?: M;
}

export interface ApiErrorEnvelope {
  success: false;
  data: null;
  error: ApiErrorBody;
}

export type ApiEnvelope<T, M = unknown> =
  ApiSuccessEnvelope<T, M> | ApiErrorEnvelope;

/** HTTP method name (upper-cased). */
export type HttpMethod =
  'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** Query parameter value supported by the API client serializer. */
export type QueryValue = string | number | boolean | null | undefined;

export interface QueryParams {
  [key: string]: QueryValue | QueryValue[];
}

export interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  /** JSON-serializable body. Objects/arrays are stringified automatically. */
  body?: unknown;
  headers?: HeadersInit;
  /** Query string parameters appended to the URL. */
  query?: QueryParams;
  /**
   * Extra retry attempts on transient failures (network errors, and 5xx for
   * idempotent methods). Defaults to `defaultRetries`.
   */
  retries?: number;
  /**
   * When true, a 401 response is surfaced as-is instead of triggering the
   * single-flight refresh flow (used by the refresh endpoint itself).
   */
  bypassRefresh?: boolean;
}

/** Success payload returned by `request`, with optional envelope `meta`. */
export interface SuccessResult<T, M = unknown> {
  data: T;
  meta?: M;
}
