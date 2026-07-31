import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HEALTH_PATH,
  SERVICE_NAME,
  SERVICE_VERSION,
} from '../config/constants';
import { PrismaService } from '../prisma/prisma.service';

interface DatabaseCheck {
  status: 'up';
  latencyMs: number;
}

export interface HealthStatus {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: DatabaseCheck;
  };
}

@ApiTags('health')
@Controller(HEALTH_PATH)
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Service health check',
    description:
      'Confirms the API is alive and that the database connection is healthy.',
  })
  async check(): Promise<HealthStatus> {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        'Health check failed: database unreachable',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database is unreachable',
      });
    }

    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: this.configService.get<string>('app.env') ?? 'development',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'up',
          latencyMs: Date.now() - startedAt,
        },
      },
    };
  }
}
