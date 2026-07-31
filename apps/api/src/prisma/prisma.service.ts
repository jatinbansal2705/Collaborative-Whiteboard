import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';

type PrismaLoggingOptions = Prisma.PrismaClientOptions & {
  log: Array<
    | { emit: 'event'; level: 'query' }
    | { emit: 'event'; level: 'info' }
    | { emit: 'event'; level: 'warn' }
    | { emit: 'event'; level: 'error' }
  >;
};

@Injectable()
export class PrismaService
  extends PrismaClient<PrismaLoggingOptions>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly queryLogEnabled: boolean;

  constructor(configService: ConfigService) {
    const logLevel = configService.get<string>('app.logLevel') ?? 'info';

    super({
      adapter: new PrismaPg({
        connectionString: configService.getOrThrow<string>('database.url'),
      }),
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });

    this.queryLogEnabled = logLevel === 'debug' || logLevel === 'trace';
  }

  async onModuleInit(): Promise<void> {
    this.registerEventListeners();
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private registerEventListeners(): void {
    this.$on('query', (event) => {
      if (this.queryLogEnabled) {
        this.logger.debug(
          `[Prisma] ${event.query} (${event.duration} ms) params=${event.params}`,
        );
      }
    });
    this.$on('info', (event) => {
      this.logger.log(`[Prisma] ${event.message}`);
    });
    this.$on('warn', (event) => {
      this.logger.warn(`[Prisma] ${event.message}`);
    });
    this.$on('error', (event) => {
      this.logger.error(`[Prisma] ${event.message}`);
    });
  }
}
