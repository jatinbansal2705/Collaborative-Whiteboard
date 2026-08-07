import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisService } from './redis.service';

jest.mock('ioredis', () => ({
  Redis: jest.fn(),
}));

const MockRedis = Redis as jest.MockedClass<typeof Redis>;

interface MockRedisClient {
  status: string;
  connect: jest.Mock;
  quit: jest.Mock;
  on: jest.Mock;
  hset: jest.Mock;
  hgetall: jest.Mock;
  hdel: jest.Mock;
  expire: jest.Mock;
  set: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
  eval: jest.Mock;
}

function makeClient(status: string): MockRedisClient {
  return {
    status,
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    hset: jest.fn(),
    hgetall: jest.fn(),
    hdel: jest.fn(),
    expire: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    eval: jest.fn(),
  };
}

function makeConfig(
  url = 'redis://localhost:6379',
): jest.Mocked<ConfigService> {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'database.redisUrl') {
        return url;
      }
      return undefined;
    }),
    get: jest.fn(),
  } as unknown as jest.Mocked<ConfigService>;
}

describe('RedisService', () => {
  let client: MockRedisClient;
  let pubClient: MockRedisClient;
  let subClient: MockRedisClient;
  let created: MockRedisClient[];

  beforeEach(() => {
    client = makeClient('wait');
    pubClient = makeClient('wait');
    subClient = makeClient('wait');
    created = [client, pubClient, subClient];
    let index = 0;
    MockRedis.mockImplementation(
      () => (created[index++] ?? created[0]) as unknown as Redis,
    );
  });

  it('connects the primary client and both adapter clients when idle', async () => {
    const service = new RedisService(makeConfig());

    await service.onModuleInit();

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(pubClient.connect).toHaveBeenCalledTimes(1);
    expect(subClient.connect).toHaveBeenCalledTimes(1);
  });

  it('does not re-connect a client the socket adapter already connected', async () => {
    subClient.status = 'connecting';
    const service = new RedisService(makeConfig());

    await service.onModuleInit();

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(pubClient.connect).toHaveBeenCalledTimes(1);
    expect(subClient.connect).not.toHaveBeenCalled();
  });

  it('skips clients that finished connecting before this hook ran', async () => {
    pubClient.status = 'ready';
    const service = new RedisService(makeConfig());

    await service.onModuleInit();

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(pubClient.connect).not.toHaveBeenCalled();
    expect(subClient.connect).toHaveBeenCalledTimes(1);
  });

  it('exposes the adapter pub/sub clients', () => {
    const service = new RedisService(makeConfig());

    expect(service.adapterClients()).toEqual({
      pubClient,
      subClient,
    });
  });

  it('delegates commands to the primary client', async () => {
    client.hset.mockResolvedValue(1);
    const service = new RedisService(makeConfig());

    await expect(
      service.hset('presence:board:1', 'socket-1', 'user-1'),
    ).resolves.toBe(1);
    expect(client.hset).toHaveBeenCalledWith(
      'presence:board:1',
      'socket-1',
      'user-1',
    );

    client.get.mockResolvedValue('{"v":1}');
    await expect(service.get('element:version:e-1')).resolves.toBe('{"v":1}');
    expect(client.get).toHaveBeenCalledWith('element:version:e-1');
  });

  it('quits every client on module destroy', async () => {
    const service = new RedisService(makeConfig());

    await service.onModuleDestroy();

    expect(client.quit).toHaveBeenCalledTimes(1);
    expect(pubClient.quit).toHaveBeenCalledTimes(1);
    expect(subClient.quit).toHaveBeenCalledTimes(1);
  });
});
