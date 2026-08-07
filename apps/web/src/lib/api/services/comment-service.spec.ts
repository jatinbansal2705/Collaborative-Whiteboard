import { afterEach, describe, expect, it, vi } from 'vitest';
import { commentService } from '@/lib/api/services/comment-service';

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('commentService', () => {
  it('lists comment threads for a board', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope([]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await commentService.list('board-1');

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/v1/boards/board-1/comments',
    );
    expect(result).toEqual([]);
  });

  it('creates a thread', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ id: 't1' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await commentService.create('board-1', {
      x: 10,
      y: 20,
      body: 'needs fixing',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'http://localhost:3000/api/v1/boards/board-1/comments',
    );
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      x: 10,
      y: 20,
      body: 'needs fixing',
    });
    expect(result).toEqual({ id: 't1' });
  });

  it('replies to a thread', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ id: 'c1' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await commentService.reply('t1', { body: 'fixed' });

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/v1/comments/t1/replies',
    );
    expect(result).toEqual({ id: 'c1' });
  });

  it('resolves a thread', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await commentService.resolve('t1', true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'http://localhost:3000/api/v1/comments/t1/resolve',
    );
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      resolved: true,
    });
  });
});
