import { afterEach, describe, expect, it, vi } from 'vitest';
import { notificationService } from '@/lib/api/services/notification-service';

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('notificationService', () => {
  it('lists notifications with a cursor and limit query', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelope({ items: [], hasNextPage: false }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await notificationService.list({ cursor: 'abc', limit: 5 });

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/v1/notifications?cursor=abc&limit=5',
    );
    expect(result).toEqual({ items: [], hasNextPage: false });
  });

  it('marks a single notification read via PATCH', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await notificationService.markRead('n1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'http://localhost:3000/api/v1/notifications/n1/read',
    );
    expect((init as RequestInit).method).toBe('PATCH');
  });

  it('marks all notifications read via PATCH', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await notificationService.markAllRead();

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/v1/notifications/read-all',
    );
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('PATCH');
  });
});
