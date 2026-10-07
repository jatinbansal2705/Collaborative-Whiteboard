import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { setupApp } from './app.setup';
import { AppModule } from './app.module';
import { getLogLevels } from './common/logger/log-levels';
import { SocketIoAdapter } from './modules/realtime/socket-io.adapter';
import { RedisService } from './redis/redis.service';
import {
  HEALTH_PATH,
  SERVICE_NAME,
  SERVICE_VERSION,
  SWAGGER_PATH,
} from './config/constants';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig['app']>('app');
  const logger = new Logger('Bootstrap');

  app.useLogger(getLogLevels(appConfig?.logLevel ?? 'info'));

  setupApp(app);

  app.useWebSocketAdapter(
    new SocketIoAdapter(app, app.get(RedisService), app.get(ConfigService)),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Collaborative Whiteboard API')
    .setDescription(
      'REST API for the Collaborative Whiteboard platform (Excalidraw + Miro).',
    )
    .setVersion(SERVICE_VERSION)
    .addTag('app', 'Service information')
    .addTag('health', 'Service health')
    .addTag('auth', 'Authentication')
    .addTag('boards', 'Boards, membership and sharing')
    .addTag('chat', 'Board chat messages and read receipts')
    .addTag('comments', 'Comment threads, replies and mentions')
    .addTag('notifications', 'In-app notifications')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Collaborative Whiteboard API Docs',
  });

  const host = appConfig?.host ?? '0.0.0.0';
  const port = appConfig?.port ?? 3000;

  await app.listen(port, host);

  logger.log(
    `${SERVICE_NAME} v${SERVICE_VERSION} listening on http://${host}:${port}`,
  );
  logger.log(
    `Swagger docs available at http://localhost:${port}/${SWAGGER_PATH}`,
  );
  logger.log(
    `Health check available at http://localhost:${port}/${HEALTH_PATH}`,
  );
}

void bootstrap();
