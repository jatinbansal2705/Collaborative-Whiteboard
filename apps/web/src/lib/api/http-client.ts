import { useAuthStore } from '@/stores/auth-store';
import type { RefreshResult } from '@/types/auth';
import { API_ENDPOINTS } from './endpoints';
import {
  ApiError,
  CLIENT_ERROR_CODES,
  fromApiErrorBody,
  fromCause,
  isApiError,
} from './errors';
import {
  computeRetryDelayMs,
  DEFAULT_RETRY_OPTIONS,
  shouldRetry,
  sleep,
  type RetryOptions,
} from './retry';
import type {
  ApiErrorEnvelope,
  ApiSuccessEnvelope,
  HttpMethod,
  QueryParams,
  RequestOptions,
  SuccessResult,
} from './types';

const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;
}

function buildQueryString(query: QueryParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      if (entry !== undefined && entry !== null) {
        params.append(key, String(entry));
      }
    }
  }
  const encoded = params.toString();
  return encoded.length > 0 ? `?${encoded}` : '';
}

function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}${buildQueryString(query ?? {})}`;
}

function isJsonBody(body: unknown): boolean {
  return (
    body !== undefined &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof Blob) &&
    typeof body !== 'string'
  );
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (isJsonBody(body)) {
    return JSON.stringify(body);
  }
  return body as BodyInit;
}

function buildHeaders(
  options: RequestOptions,
  accessToken: string | null,
): Headers {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (isJsonBody(options.body)) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken !== null) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return headers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  return (
    isRecord(value) &&
    value.success === false &&
    isRecord(value.error) &&
    typeof value.error.code === 'string'
  );
}

function isSuccessEnvelope(
  value: unknown,
): value is ApiSuccessEnvelope<unknown> {
  return isRecord(value) && value.success === true && 'data' in value;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'AbortError';
}

export interface HttpClientOptions {
  baseUrl?: string;
  retryOptions?: Partial<RetryOptions>;
  getAccessToken?: () => string | null;
}

/**
 * Centralized API client. Injects the bearer token from the auth store,
 * serializes query/body, retries transient failures with exponential backoff,
 * and performs a single-flight refresh on 401 so concurrent requests share one
 * token rotation.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly retryOptions: RetryOptions;
  private readonly getAccessToken: () => string | null;
  private refreshPromise: Promise<string> | null = null;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? getApiBaseUrl();
    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options.retryOptions };
    this.getAccessToken = options.getAccessToken ?? defaultGetAccessToken;
  }

  get<T, M = unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<SuccessResult<T, M>> {
    return this.request<T, M>(path, { ...options, method: 'GET' });
  }

  post<T, M = unknown>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<SuccessResult<T, M>> {
    return this.request<T, M>(path, { ...options, method: 'POST', body });
  }

  put<T, M = unknown>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<SuccessResult<T, M>> {
    return this.request<T, M>(path, { ...options, method: 'PUT', body });
  }

  patch<T, M = unknown>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<SuccessResult<T, M>> {
    return this.request<T, M>(path, { ...options, method: 'PATCH', body });
  }

  delete<T, M = unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<SuccessResult<T, M>> {
    return this.request<T, M>(path, { ...options, method: 'DELETE' });
  }

  async request<T, M = unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<SuccessResult<T, M>> {
    return this.execute<T, M>(path, options, { attempt: 0, refreshed: false });
  }

  private async execute<T, M>(
    path: string,
    options: RequestOptions,
    state: { attempt: number; refreshed: boolean },
  ): Promise<SuccessResult<T, M>> {
    const retries = options.retries ?? this.retryOptions.maxRetries;
    const method = (options.method ?? 'GET') as HttpMethod;

    const init: RequestInit = {
      method,
      headers: buildHeaders(options, this.getAccessToken()),
      body: serializeBody(options.body),
      cache: options.cache,
      credentials: options.credentials,
      integrity: options.integrity,
      keepalive: options.keepalive,
      mode: options.mode,
      redirect: options.redirect,
      referrer: options.referrer,
      referrerPolicy: options.referrerPolicy,
      signal: options.signal,
    };

    let response: Response;
    try {
      response = await fetch(buildUrl(this.baseUrl, path, options.query), init);
    } catch (cause) {
      if (isAbortError(cause)) {
        throw fromCause(
          cause,
          'The request was aborted',
          0,
          CLIENT_ERROR_CODES.TIMEOUT,
        );
      }
      if (state.attempt < retries) {
        await sleep(computeRetryDelayMs(state.attempt + 1, this.retryOptions));
        return this.execute<T, M>(path, options, {
          ...state,
          attempt: state.attempt + 1,
        });
      }
      throw fromCause(
        cause,
        'Unable to reach the server. Check your connection and try again.',
        0,
        CLIENT_ERROR_CODES.NETWORK_ERROR,
      );
    }

    if (response.status === 401 && !options.bypassRefresh && !state.refreshed) {
      await this.refreshTokens();
      return this.execute<T, M>(path, options, {
        ...state,
        refreshed: true,
      });
    }

    if (!response.ok) {
      const apiError = await toApiError(response, method);
      if (apiError.retryable && state.attempt < retries) {
        await sleep(computeRetryDelayMs(state.attempt + 1, this.retryOptions));
        return this.execute<T, M>(path, options, {
          ...state,
          attempt: state.attempt + 1,
        });
      }
      throw apiError;
    }

    return this.parseSuccess<T, M>(response);
  }

  /**
   * Single-flight refresh: concurrent 401s share one rotation promise. On
   * failure the session is cleared and every waiter rejects with
   * `AUTH_REQUIRED`.
   */
  private refreshTokens(): Promise<string> {
    if (this.refreshPromise === null) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async performRefresh(): Promise<string> {
    const store = useAuthStore.getState();
    const refreshToken = store.refreshToken;
    if (refreshToken === null) {
      store.clear();
      throw new ApiError('Your session has expired. Please sign in again.', {
        code: CLIENT_ERROR_CODES.AUTH_REQUIRED,
        status: 401,
      });
    }

    try {
      const { data } = await this.request<RefreshResult>(
        API_ENDPOINTS.auth.refresh,
        {
          method: 'POST',
          body: { refreshToken },
          bypassRefresh: true,
          retries: 0,
        },
      );
      useAuthStore.getState().setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return data.accessToken;
    } catch (cause) {
      useAuthStore.getState().clear();
      if (isApiError(cause) && cause.status === 401) {
        throw new ApiError('Your session has expired. Please sign in again.', {
          code: CLIENT_ERROR_CODES.AUTH_REQUIRED,
          status: 401,
          cause,
        });
      }
      throw cause;
    }
  }

  private async parseSuccess<T, M>(
    response: Response,
  ): Promise<SuccessResult<T, M>> {
    const body = await parseJson(response);
    if (isErrorEnvelope(body)) {
      throw fromApiErrorBody(body.error, response.status);
    }
    if (isSuccessEnvelope(body)) {
      return {
        data: body.data as T,
        meta: body.meta as M | undefined,
      };
    }
    if (body === null && response.status === 204) {
      return { data: undefined as T };
    }
    throw fromCause(
      null,
      'The server returned an unexpected response.',
      response.status,
      CLIENT_ERROR_CODES.INVALID_RESPONSE,
    );
  }
}

function defaultGetAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

async function toApiError(
  response: Response,
  method: HttpMethod,
): Promise<ApiError> {
  const body = await parseJson(response);
  if (isErrorEnvelope(body)) {
    return fromApiErrorBody(
      body.error,
      response.status,
      shouldRetry(response.status, method),
    );
  }
  return fromCause(
    null,
    response.statusText || `Request failed with status ${response.status}`,
    response.status,
    CLIENT_ERROR_CODES.INVALID_RESPONSE,
  );
}

/** Shared singleton used by every service module. */
export const httpClient = new HttpClient();
