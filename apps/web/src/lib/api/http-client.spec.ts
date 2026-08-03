import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, CLIENT_ERROR_CODES, isApiError } from '@/lib/api/errors';
import { HttpClient } from '@/lib/api/http-client';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthUser } from '@/types/auth';

const BASE_URL = 'http://test.local/api/v1';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function successEnvelope(data: unknown, meta?: unknown): unknown {
  return { success: true, data, meta };
}

function errorEnvelope(code: string, message: string): unknown {
  return {
    success: false,
    data: null,
    error: { code, message, details: null },
  };
}

function client(): HttpClient {
  return new HttpClient({
    baseUrl: BASE_URL,
    retryOptions: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10, jitter: 0 },
  });
}

const user: AuthUser = {
  id: 'user-1',
  email: 'ada@example.com',
  role: 'USER',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function resetAuthStore(): void {
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    status: 'unauthenticated',
  });
}

beforeEach(() => {
  resetAuthStore();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpClient', () => {
  it('returns envelope data and meta', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          successEnvelope({ id: 'b1' }, { hasNextPage: false }),
          200,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await client().get<{ id: string }, { hasNextPage: boolean }>(
      '/boards/b1',
    );

    expect(result.data).toEqual({ id: 'b1' });
    expect(result.meta).toEqual({ hasNextPage: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${BASE_URL}/boards/b1`);
  });

  it('serializes query params and skips nullish values', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(successEnvelope([]), 200));
    vi.stubGlobal('fetch', fetchMock);

    await client().get('/boards', {
      query: {
        search: 'roadmap',
        limit: 20,
        filter: undefined,
        archived: null,
        tags: ['a', 'b'],
      },
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe(
      `${BASE_URL}/boards?search=roadmap&limit=20&tags=a&tags=b`,
    );
  });

  it('injects the bearer token and JSON body', async () => {
    useAuthStore.setState({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      user,
      status: 'authenticated',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(successEnvelope({ message: 'ok' }), 200));
    vi.stubGlobal('fetch', fetchMock);

    await client().post('/auth/logout', { everywhere: true });

    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe(`${BASE_URL}/auth/logout`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ everywhere: true });
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer at-1');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('returns undefined data for a 204 response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await client().delete<void>('/boards/b1');

    expect(result.data).toBeUndefined();
  });

  it('maps a server error envelope to ApiError without retrying', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(errorEnvelope('NOT_FOUND', 'Board not found'), 404),
      );
    vi.stubGlobal('fetch', fetchMock);

    const error = await client()
      .get('/boards/b1')
      .then(() => null)
      .catch((caught: unknown) => caught);

    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      message: 'Board not found',
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed success body as INVALID_RESPONSE', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ hello: 1 }, 200));
    vi.stubGlobal('fetch', fetchMock);

    const error = await client()
      .get('/boards')
      .then(() => null)
      .catch((caught: unknown) => caught);

    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).code).toBe(CLIENT_ERROR_CODES.INVALID_RESPONSE);
  });

  it('retries a network failure with backoff then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(
        jsonResponse(successEnvelope({ message: 'recovered' }), 200),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await client().get<{ message: string }>('/health');

    expect(result.data).toEqual({ message: 'recovered' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('exhausts retries and surfaces NETWORK_ERROR', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const error = await client()
      .get('/health')
      .then(() => null)
      .catch((caught: unknown) => caught);

    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).code).toBe(CLIENT_ERROR_CODES.NETWORK_ERROR);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries 5xx only for idempotent methods', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(errorEnvelope('ERR', 'oops'), 500))
      .mockResolvedValueOnce(jsonResponse(errorEnvelope('ERR', 'oops'), 500))
      .mockResolvedValue(jsonResponse(successEnvelope(null), 200));
    vi.stubGlobal('fetch', fetchMock);

    await client().get('/boards');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry 5xx for a POST', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(errorEnvelope('ERR', 'boom'), 500));
    vi.stubGlobal('fetch', fetchMock);

    const error = await client()
      .post('/boards', { title: 'x' })
      .then(() => null)
      .catch((caught: unknown) => caught);

    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).retryable).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries 429 for any method', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(errorEnvelope('RATE', 'slow down'), 429),
      )
      .mockResolvedValueOnce(
        jsonResponse(errorEnvelope('RATE', 'slow down'), 429),
      )
      .mockResolvedValue(jsonResponse(successEnvelope(null), 200));
    vi.stubGlobal('fetch', fetchMock);

    await client().post('/boards', { title: 'x' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('bypassRefresh surfaces a 401 without touching the session', async () => {
    useAuthStore.setState({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      user,
      status: 'authenticated',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(errorEnvelope('UNAUTHORIZED', 'nope'), 401),
      );
    vi.stubGlobal('fetch', fetchMock);

    const error = await client()
      .post('/auth/refresh', { refreshToken: 'rt-1' }, { bypassRefresh: true })
      .then(() => null)
      .catch((caught: unknown) => caught);

    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).status).toBe(401);
    expect(useAuthStore.getState().accessToken).toBe('at-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes once for concurrent 401s and retries with the new token', async () => {
    useAuthStore.setState({
      accessToken: 'at-expired',
      refreshToken: 'rt-1',
      user,
      status: 'authenticated',
    });

    const boardBodies = [
      errorEnvelope('UNAUTHORIZED', 'expired'),
      errorEnvelope('UNAUTHORIZED', 'expired'),
      successEnvelope({ id: 'b1' }),
      successEnvelope({ id: 'b2' }),
    ];
    const refreshMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          successEnvelope({
            accessToken: 'at-new',
            refreshToken: 'rt-2',
            expiresIn: 900,
          }),
          200,
        ),
      ),
    );

    const fetchMock = vi.fn().mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return refreshMock(url);
      }
      const body = boardBodies.shift();
      return Promise.resolve(
        jsonResponse(
          body,
          url.includes('/boards')
            ? body && (body as { success?: boolean }).success
              ? 200
              : 401
            : 500,
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const sharedClient = client();
    const [first, second] = await Promise.all([
      sharedClient.get<{ id: string }>('/boards'),
      sharedClient.get<{ id: string }>('/boards'),
    ]);

    expect(first.data.id).toBe('b1');
    expect(second.data.id).toBe('b2');
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(5);

    const store = useAuthStore.getState();
    expect(store.accessToken).toBe('at-new');
    expect(store.refreshToken).toBe('rt-2');
    expect(store.status).toBe('authenticated');

    const boardHeaders = fetchMock.mock.calls
      .map((call) => (call[1] as RequestInit).headers as Headers)
      .filter((_, index) => {
        const url = String(fetchMock.mock.calls[index][0]);
        return url.includes('/boards');
      });
    expect(String(boardHeaders[0].get('Authorization'))).toBe(
      'Bearer at-expired',
    );
    expect(String(boardHeaders[1].get('Authorization'))).toBe(
      'Bearer at-expired',
    );
    expect(String(boardHeaders[2].get('Authorization'))).toBe('Bearer at-new');
    expect(String(boardHeaders[3].get('Authorization'))).toBe('Bearer at-new');
  });

  it('clears the session and throws AUTH_REQUIRED when refresh fails', async () => {
    useAuthStore.setState({
      accessToken: 'at-expired',
      refreshToken: 'rt-1',
      user,
      status: 'authenticated',
    });

    const fetchMock = vi.fn().mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(
          jsonResponse(errorEnvelope('UNAUTHORIZED', 'invalid token'), 401),
        );
      }
      return Promise.resolve(
        jsonResponse(errorEnvelope('UNAUTHORIZED', 'expired'), 401),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const error = await client()
      .get('/boards')
      .then(() => null)
      .catch((caught: unknown) => caught);

    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).code).toBe(CLIENT_ERROR_CODES.AUTH_REQUIRED);
    expect((error as ApiError).isAuthError).toBe(true);

    const store = useAuthStore.getState();
    expect(store.accessToken).toBeNull();
    expect(store.refreshToken).toBeNull();
    expect(store.status).toBe('unauthenticated');
  });

  it('throws AUTH_REQUIRED when no refresh token exists', async () => {
    useAuthStore.setState({
      accessToken: 'at-expired',
      refreshToken: null,
      user: null,
      status: 'authenticated',
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(errorEnvelope('UNAUTHORIZED', 'expired'), 401),
      );
    vi.stubGlobal('fetch', fetchMock);

    const error = await client()
      .get('/boards')
      .then(() => null)
      .catch((caught: unknown) => caught);

    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).code).toBe(CLIENT_ERROR_CODES.AUTH_REQUIRED);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
