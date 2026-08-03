import type { ApiErrorBody } from './types';

/** Stable error codes raised by the API client itself (server codes pass through). */
export const CLIENT_ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  TIMEOUT: 'TIMEOUT',
} as const;

export type ClientErrorCode =
  (typeof CLIENT_ERROR_CODES)[keyof typeof CLIENT_ERROR_CODES];

export interface ApiErrorOptions {
  code: string;
  status: number;
  details?: unknown;
  retryable?: boolean;
  cause?: unknown;
}

/** Typed error for every failed API call, mirroring the server error envelope. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(message: string, options: ApiErrorOptions) {
    super(
      message,
      options.cause instanceof Error ? { cause: options.cause } : undefined,
    );
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
  }

  /** True when the caller is unauthenticated and a refresh is impossible. */
  get isAuthError(): boolean {
    return (
      this.status === 401 || this.code === CLIENT_ERROR_CODES.AUTH_REQUIRED
    );
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Build an ApiError from a parsed server error envelope. */
export function fromApiErrorBody(
  body: ApiErrorBody,
  status: number,
  retryable = false,
): ApiError {
  return new ApiError(body.message || 'The request could not be processed', {
    code: body.code || `HTTP_${status}`,
    status,
    details: body.details,
    retryable,
  });
}

/** Build an ApiError for non-envelope (network / malformed) failures. */
export function fromCause(
  cause: unknown,
  message: string,
  status: number,
  code: ClientErrorCode,
): ApiError {
  return new ApiError(message, { code, status, retryable: true, cause });
}
