import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { API_PREFIX, HEALTH_PATH } from './config/constants';
import type { AppConfig } from './config/configuration';
import { requestId } from './common/middleware/request-id.middleware';

const DEFAULT_CORS_ORIGINS = ['http://localhost:3001'];

export function setupApp(app: INestApplication): INestApplication {
  const configService = app.get(ConfigService);
  const corsOrigins =
    configService.get<AppConfig['app']>('app')?.corsOrigins ??
    DEFAULT_CORS_ORIGINS;

  app.use(requestId);
  app.setGlobalPrefix(API_PREFIX, { exclude: [HEALTH_PATH] });
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'x-request-id'],
  });
  app.enableShutdownHooks();

  return app;
}
