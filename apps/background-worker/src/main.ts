import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BackgroundWorkerModule } from './background-worker.module';

async function bootstrap() {
  const logger = new Logger('BackgroundWorker');

  const app = await NestFactory.create(BackgroundWorkerModule);

  logger.log('🚀 Starting background worker...');
  logger.log(
    `📡 Kafka brokers: ${process.env.KAFKA_BROKERS || 'localhost:19092'}`,
  );
  logger.log('🎧 KafkaJS listeners will auto-start via OnModuleInit');

  await app.listen(process.env.PORT ?? 3001);
  logger.log(`HTTP server listening on port ${process.env.PORT ?? 3001}`);
  logger.log('Background worker ready (Kafka consumers running)');
}
bootstrap();
