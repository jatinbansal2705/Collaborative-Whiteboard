import { Test, type TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get(AppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return service information', () => {
    expect(controller.getInfo()).toEqual({
      name: 'collaborative-whiteboard-api',
      version: '0.1.0',
      docsUrl: '/docs',
      healthUrl: '/health',
    });
  });
});
