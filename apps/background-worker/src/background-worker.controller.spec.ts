import { Test, TestingModule } from '@nestjs/testing';
import { BackgroundWorkerController } from './background-worker.controller';
import { BackgroundWorkerService } from './background-worker.service';

describe('BackgroundWorkerController', () => {
  let backgroundWorkerController: BackgroundWorkerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [BackgroundWorkerController],
      providers: [BackgroundWorkerService],
    }).compile();

    backgroundWorkerController = app.get<BackgroundWorkerController>(
      BackgroundWorkerController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(backgroundWorkerController.getHello()).toBe('Hello World!');
    });
  });
});
