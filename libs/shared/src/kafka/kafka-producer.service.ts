import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { KafkaConfigService } from './kafka-config.service';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private producer: Producer;
  private kafka: Kafka;
  private readonly logger: Logger;

  constructor(private readonly kafkaConfigService: KafkaConfigService) {
    this.logger = new Logger(KafkaProducerService.name);
    this.kafka = new Kafka(this.kafkaConfigService.getProducerConfig());
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.logger.log('Kafka producer connected');
    } catch (error) {
      this.logger.error('Failed to connect Kafka producer', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      this.logger.log('Kafka producer disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect Kafka producer', error);
    }
  }

  async send<T>(topic: string, message: T, key?: string): Promise<void> {
    try {
      const messageValue = JSON.stringify(message);

      await this.producer.send({
        topic,
        messages: [
          {
            key: key || Date.now().toString(),
            value: messageValue,
          },
        ],
      });

      this.logger.log(`Message sent to topic ${topic}`, { key });
    } catch (error) {
      this.logger.error(`Failed to send message to topic ${topic}`, error);
      throw error;
    }
  }

  /**
   * Fire-and-forget emit
   * Không chờ broker ack (acks=0)
   */
  emit<T>(topic: string, message: T, key?: string): void {
    const messageValue = JSON.stringify(message);

    this.producer
      .send({
        topic,
        acks: 0, // fire-and-forget
        messages: [
          {
            key: key || Date.now().toString(),
            value: messageValue,
          },
        ],
      })
      .then(() => {
        this.logger.log(`Emit (fire-and-forget) to ${topic}`, { key });
      })
      .catch((error) => {
        this.logger.error(`Failed to emit message to topic ${topic}`, error);
      });
  }
}
