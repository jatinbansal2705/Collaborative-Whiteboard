import { type INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server, ServerOptions } from 'socket.io';
import { RedisService } from '../../redis/redis.service';

/**
 * Socket.IO adapter wired with CORS from the app config and a Redis
 * pub/sub adapter (ADR-0003) so broadcasts fan out across API instances.
 */
export class SocketIoAdapter extends IoAdapter {
  private readonly logger = new Logger(SocketIoAdapter.name);

  constructor(
    app: INestApplicationContext,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    const corsOrigins = this.configService.get<string[]>('app.corsOrigins') ?? [
      'http://localhost:3001',
    ];

    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: corsOrigins, credentials: true },
    }) as Server;

    const { pubClient, subClient } = this.redisService.adapterClients();
    server.adapter(createAdapter(pubClient, subClient));
    this.logger.log('Socket.IO Redis adapter attached');

    return server;
  }
}
