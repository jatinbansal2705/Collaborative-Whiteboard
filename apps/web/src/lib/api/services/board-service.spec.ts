import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardService } from '@/lib/api/services/board-service';

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function emptyResponse(): Response {
  return new Response(null, { status: 204 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('boardService', () => {
  it('creates a board', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ id: 'b1' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await boardService.create({ title: 'Roadmap' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:3000/api/v1/boards');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      title: 'Roadmap',
    });
    expect(result).toEqual({ id: 'b1' });
  });

  it('fetches board detail', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ id: 'b1' }));
    vi.stubGlobal('fetch', fetchMock);

    await boardService.get('b1');

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/v1/boards/b1',
    );
  });

  it('sets a favourite via POST and clears it via DELETE', async () => {
    const postMock = vi.fn().mockResolvedValue(envelope({ favourite: true }));
    vi.stubGlobal('fetch', postMock);
    await boardService.setFavourite('b1', true);
    expect(String(postMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/v1/boards/b1/favourite',
    );
    expect((postMock.mock.calls[0][1] as RequestInit).method).toBe('POST');

    const deleteMock = vi
      .fn()
      .mockResolvedValue(envelope({ favourite: false }));
    vi.stubGlobal('fetch', deleteMock);
    await boardService.setFavourite('b1', false);
    expect(String(deleteMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/v1/boards/b1/favourite',
    );
    expect((deleteMock.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
  });

  it('lists versions with pagination', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await boardService.listVersions('b1', { cursor: 'x', limit: 10 });

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/v1/boards/b1/versions?cursor=x&limit=10',
    );
  });

  it('restores a version via POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ version: 3 }));
    vi.stubGlobal('fetch', fetchMock);

    await boardService.restoreVersion('b1', 3);

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/v1/boards/b1/versions/3/restore',
    );
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('saves document data with a base revision', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ revision: 7 }));
    vi.stubGlobal('fetch', fetchMock);

    await boardService.saveData('b1', {
      data: { elements: [] },
      baseRevision: 6,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:3000/api/v1/boards/b1/data');
    expect((init as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      data: { elements: [] },
      baseRevision: 6,
    });
  });

  it('removes a member via DELETE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse());
    vi.stubGlobal('fetch', fetchMock);

    await boardService.removeMember('b1', 'user-2');

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/v1/boards/b1/members/user-2',
    );
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
  });
});
