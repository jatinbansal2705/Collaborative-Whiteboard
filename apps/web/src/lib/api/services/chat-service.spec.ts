import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatService } from '@/lib/api/services/chat-service';

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chatService', () => {
  it('fetches messages with pagination query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatService.messages('board-1', { limit: 20 });

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/v1/boards/board-1/messages?limit=20',
    );
    expect(result).toEqual({ items: [] });
  });

  it('posts a message with the input body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ id: 'm1' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatService.send('board-1', {
      body: 'hello',
      attachmentUrl: 'https://example.com/img.png',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'http://localhost:3000/api/v1/boards/board-1/messages',
    );
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      body: 'hello',
      attachmentUrl: 'https://example.com/img.png',
    });
    expect(result).toEqual({ id: 'm1' });
  });
});
