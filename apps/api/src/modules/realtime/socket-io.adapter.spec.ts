import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server } from 'socket.io';
import { RedisService } from '../../redis/redis.service';
import { SocketIoAdapter } from './socket-io.adapter';

const APP = {} as INestApplicationContext;

const pubClient = { id: 'pub' };
const subClient = { id: 'sub' };

function makeRedisService(adapterClients: jest.Mock): RedisService {
  return { adapterClients } as unknown as RedisService;
}

function makeConfig(corsOrigins?: string[]): jest.Mocked<ConfigService> {
  const config = {
    get: jest.fn(),
  } as unknown as jest.Mocked<ConfigService>;
  config.get.mockImplementation((key: string) => {
    if (key === 'app.corsOrigins') {
      return corsOrigins;
    }
    return undefined;
  });
  return config;
}

describe('SocketIoAdapter', () => {
  let superSpy: jest.SpyInstance;
  let server: Server;
  let serverAdapter: jest.Mock;

  beforeEach(() => {
    serverAdapter = jest.fn();
    server = { adapter: serverAdapter } as unknown as Server;
    superSpy = jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockImplementation(() => server);
  });

  afterEach(() => {
    superSpy.mockRestore();
  });

  it('creates an IO server with CORS from app config and the Redis adapter', () => {
    const adapterClients = jest.fn().mockReturnValue({ pubClient, subClient });
    const redisService = makeRedisService(adapterClients);
    const config = makeConfig([
      'http://localhost:3001',
      'https://app.example.com',
    ]);
    const adapter = new SocketIoAdapter(APP, redisService, config);

    const result = adapter.createIOServer(8080, { path: '/socket.io' });

    expect(superSpy).toHaveBeenCalledWith(8080, {
      path: '/socket.io',
      cors: {
        origin: ['http://localhost:3001', 'https://app.example.com'],
        credentials: true,
      },
    });
    expect(adapterClients).toHaveBeenCalledTimes(1);
    expect(serverAdapter).toHaveBeenCalledTimes(1);
    expect(result).toBe(server);
  });

  it('falls back to the default origin when corsOrigins is not configured', () => {
    const adapterClients = jest.fn().mockReturnValue({ pubClient, subClient });
    const redisService = makeRedisService(adapterClients);
    const config = makeConfig(undefined);
    const adapter = new SocketIoAdapter(APP, redisService, config);

    adapter.createIOServer(8080);

    expect(superSpy).toHaveBeenCalledWith(8080, {
      cors: { origin: ['http://localhost:3001'], credentials: true },
    });
  });

  it('preserves extra options passed by the caller', () => {
    const adapterClients = jest.fn().mockReturnValue({ pubClient, subClient });
    const redisService = makeRedisService(adapterClients);
    const config = makeConfig(['http://localhost:3001']);
    const adapter = new SocketIoAdapter(APP, redisService, config);

    adapter.createIOServer(8080, { maxHttpBufferSize: 5_000_000 });

    expect(superSpy).toHaveBeenCalledWith(
      8080,
      expect.objectContaining({ maxHttpBufferSize: 5_000_000 }),
    );
  });
});
