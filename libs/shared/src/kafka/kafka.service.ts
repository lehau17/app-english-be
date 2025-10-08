import { Injectable, Logger } from '@nestjs/common';
import { KafkaProducerService } from './kafka-producer.service';

/**
 * Backward compatibility wrapper for KafkaService
 * Delegates to KafkaProducerService
 */
@Injectable()
export class KafkaService {
  private readonly logger = new Logger(KafkaService.name);

  constructor(private readonly producerService: KafkaProducerService) {}

  /**
   * Send message to Kafka topic
   * @deprecated Use KafkaProducerService.send() directly
   */
  send(topic: string, message: any): void {
    this.producerService.emit(topic, message);
    this.logger.log(`Emitted message to topic: ${topic}`);
  }

  /**
   * Send message and wait for ack
   */
  async sendAsync(topic: string, message: any, key?: string): Promise<void> {
    await this.producerService.send(topic, message, key);
  }
}
