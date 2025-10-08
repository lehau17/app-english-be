import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NotificationModule } from './notification.module';

async function bootstrap() {
  const logger = new Logger('NotificationApp');
  const app = await NestFactory.create(NotificationModule);

  logger.log('🚀 Starting notification service...');
  logger.log(`📡 Kafka brokers: ${process.env.KAFKA_BROKERS || 'localhost:19092'}`);
  logger.log('🎧 KafkaJS listener will auto-start via OnModuleInit');

  await app.listen(process.env.PORT ?? 3002);
  logger.log(`✅ HTTP server listening on port ${process.env.PORT ?? 3002}`);
  logger.log('✅ Notification service ready (Kafka consumer running)');
}
bootstrap();
