import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from '@/lib/api/services/auth-service';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthUser } from '@/types/auth';

const BASE = 'http://localhost:3000/api/v1';

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorEnvelope(code: string, message: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      data: null,
      error: { code, message, details: null },
    }),
    { status: 401 },
  );
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

describe('authService', () => {
  it('posts login credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ user }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await authService.login({
      email: 'ada@example.com',
      password: 'secret',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/auth/login`);
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email: 'ada@example.com',
      password: 'secret',
    });
    expect(result).toEqual({ user });
  });

  it('refreshes with bypass flags and no retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        envelope({ accessToken: 'at-2', refreshToken: 'rt-2' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await authService.refresh('rt-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/auth/refresh`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      refreshToken: 'rt-1',
    });
    expect(result).toEqual({ accessToken: 'at-2', refreshToken: 'rt-2' });
  });

  it('init resolves the session to unauthenticated without a token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await authService.init();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('init revalidates the profile with a stored token', async () => {
    useAuthStore.setState({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      user: null,
      status: 'authenticated',
    });
    const fetchMock = vi.fn().mockResolvedValue(envelope(user));
    vi.stubGlobal('fetch', fetchMock);

    await authService.init();

    expect(String(fetchMock.mock.calls[0][0])).toBe(`${BASE}/auth/me`);
    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('init clears the session when the token is dead', async () => {
    useAuthStore.setState({
      accessToken: 'at-dead',
      refreshToken: 'rt-1',
      user,
      status: 'authenticated',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(errorEnvelope('UNAUTHORIZED', 'expired'));
    vi.stubGlobal('fetch', fetchMock);

    await authService.init();

    const store = useAuthStore.getState();
    expect(store.accessToken).toBeNull();
    expect(store.refreshToken).toBeNull();
    expect(store.user).toBeNull();
    expect(store.status).toBe('unauthenticated');
  });
});
