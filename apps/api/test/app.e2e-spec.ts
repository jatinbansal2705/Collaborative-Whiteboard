import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { setupApp } from '../src/app.setup';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from '../src/common/types/api-response.type';

process.env.DATABASE_URL ??=
  'postgresql://whiteboard:whiteboard@localhost:5432/whiteboard?schema=public';

const readSuccess = <T>(response: request.Response): ApiSuccessResponse<T> =>
  response.body as ApiSuccessResponse<T>;

const readError = (response: request.Response): ApiErrorResponse =>
  response.body as ApiErrorResponse;

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  const queryRaw = jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    queryRaw.mockReset();
  });

  it('GET /health returns a healthy envelope', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({ success: true });
    expect(
      readSuccess<{
        status: string;
        checks: { database: { status: string } };
      }>(response).data,
    ).toMatchObject({
      status: 'ok',
      checks: { database: { status: 'up' } },
    });
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('GET /health returns a 503 envelope when the database is down', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);

    expect(response.body).toMatchObject({ success: false, data: null });
    expect(readError(response).error).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Database is unreachable',
    });
  });

  it('GET /api/v1 returns service information wrapped in the envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1')
      .expect(200);

    expect(response.body).toMatchObject({ success: true });
    expect(readSuccess<{ name: string }>(response).data.name).toBe(
      'collaborative-whiteboard-api',
    );
  });

  it('GET an unknown route returns a 404 envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .expect(404);

    expect(response.body).toMatchObject({ success: false, data: null });
    expect(readError(response).error.code).toBe('NOT_FOUND');
  });

  it('GET the root path is not exposed outside the api prefix', async () => {
    await request(app.getHttpServer()).get('/').expect(404);
  });
});
