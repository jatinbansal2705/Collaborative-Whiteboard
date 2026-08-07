import { afterEach, describe, expect, it, vi } from 'vitest';
import { healthService } from '@/lib/api/services/health-service';

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('healthService', () => {
  it('checks the health endpoint', async () => {
    const status = {
      status: 'ok',
      service: 'api',
      version: '1.0.0',
      environment: 'test',
      uptime: 5,
      timestamp: '2026-01-01T00:00:00.000Z',
      checks: { database: { status: 'up', latencyMs: 2 } },
    };
    const fetchMock = vi.fn().mockResolvedValue(envelope(status));
    vi.stubGlobal('fetch', fetchMock);

    const result = await healthService.check();

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/v1/health',
    );
    expect(result).toEqual(status);
  });
});
