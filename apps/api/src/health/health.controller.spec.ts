import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  const queryRaw = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: { $queryRaw: queryRaw },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test') },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should report a healthy status when the database is reachable', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.checks.database.status).toBe('up');
    expect(result.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.environment).toBe('test');
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should throw ServiceUnavailableException when the database is unreachable', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
