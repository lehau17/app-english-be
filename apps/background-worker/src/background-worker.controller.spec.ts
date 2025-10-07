import { Test, TestingModule } from '@nestjs/testing';

// Set required environment variables before imports
process.env.KAFKA_BROKERS = 'localhost:9092';

// Mock the Kafka module to prevent initialization issues
jest.mock('@app/shared/kafka/kafka.module', () => ({
  KafkaModule: {
    register: jest.fn(() => ({
      module: class MockKafkaModule {},
      providers: [],
      exports: [],
    })),
  },
}));

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
