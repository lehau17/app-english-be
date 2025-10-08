import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaConfigService } from './kafka-config.service';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaService } from './kafka.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [KafkaConfigService, KafkaProducerService, KafkaService],
  exports: [KafkaConfigService, KafkaProducerService, KafkaService],
})
export class KafkaModule {}
