import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

const ADAPTER_RETRY_OPTIONS = {
  maxRetriesPerRequest: null,
  lazyConnect: true,
} as const;

/**
 * Owns the API's Redis connections. The primary client serves the presence
 * registry and per-element version store; two dedicated pub/sub clients are
 * handed to the Socket.IO adapter (ADR-0003) so broadcasts fan out across
 * API instances.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly url: string;
  private readonly client: Redis;
  private readonly adapterPubClient: Redis;
  private readonly adapterSubClient: Redis;

  constructor(configService: ConfigService) {
    this.url = configService.getOrThrow<string>('database.redisUrl');
    this.client = new Redis(this.url, { lazyConnect: true });
    this.adapterPubClient = new Redis(this.url, ADAPTER_RETRY_OPTIONS);
    this.adapterSubClient = new Redis(this.url, ADAPTER_RETRY_OPTIONS);
  }

  async onModuleInit(): Promise<void> {
    this.attachErrorHandlers(this.client, 'client');
    this.attachErrorHandlers(this.adapterPubClient, 'pub');
    this.attachErrorHandlers(this.adapterSubClient, 'sub');
    await Promise.all([
      this.ensureConnected(this.client),
      this.ensureConnected(this.adapterPubClient),
      this.ensureConnected(this.adapterSubClient),
    ]);
    this.logger.log('Redis connections established');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.client.quit(),
      this.adapterPubClient.quit(),
      this.adapterSubClient.quit(),
    ]);
  }

  /**
   * Connects a lazy client unless the Socket.IO Redis adapter already
   * triggered a connect (subscribers auto-connect on first `subscribe()`,
   * which happens during socket-server bootstrap before this hook runs).
   * Calling `connect()` again would reject with "Redis is already
   * connecting/connected".
   */
  private async ensureConnected(client: Redis): Promise<void> {
    if (client.status === 'wait') {
      await client.connect();
    }
  }

  /** Pub/sub clients for `@socket.io/redis-adapter` (one connection each). */
  adapterClients(): { pubClient: Redis; subClient: Redis } {
    return {
      pubClient: this.adapterPubClient,
      subClient: this.adapterSubClient,
    };
  }

  hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  hdel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hdel(key, ...fields);
  }

  expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  set(key: string, value: string): Promise<string> {
    return this.client.set(key, value);
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  eval(script: string, keys: string[], args: string[]): Promise<unknown> {
    return this.client.eval(script, keys.length, ...keys, ...args);
  }

  private attachErrorHandlers(client: Redis, label: string): void {
    client.on('error', (error: Error) => {
      this.logger.error(`[Redis:${label}] ${error.message}`);
    });
  }
}
