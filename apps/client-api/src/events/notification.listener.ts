import { KafkaConfigService, KafkaTopic } from '@app/shared';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { EventsGateway } from './events.gateway';

@Injectable()
export class NotificationListener implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private kafka: Kafka;
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly kafkaConfigService: KafkaConfigService,
    private readonly gateway: EventsGateway,
  ) {
    this.kafka = new Kafka(this.kafkaConfigService.getConsumerConfig());
    this.consumer = this.kafka.consumer({
      groupId: 'client-api-notifications',
      retry: {
        initialRetryTime: 300,
        retries: 3,
        maxRetryTime: 30000,
        factor: 0.2,
        multiplier: 2,
      },
    });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      this.logger.log('Notification listener connected to Kafka');

      await this.consumer.subscribe({
        topics: [KafkaTopic.NOTIFICATION_SEND_OTP_CREATED, 'notifications'],
        fromBeginning: false,
      });
      this.logger.log(
        `Subscribed to topics: ${KafkaTopic.NOTIFICATION_SEND_OTP_CREATED}, notifications`,
      );

      // Event listeners
      this.consumer.on(this.consumer.events.GROUP_JOIN, (e) =>
        this.logger.log('GROUP_JOIN', e.payload),
      );
      this.consumer.on(this.consumer.events.CRASH, (e) =>
        this.logger.error('CRASH', e.payload.error),
      );

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.processMessage(topic, partition, message);
        },
      });

      this.logger.log('Notification consumer running');
    } catch (error) {
      this.logger.error('Failed to initialize notification listener', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
      this.logger.log('Notification listener disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect notification listener', error);
    }
  }

  private async processMessage(topic: string, partition: number, message: any) {
    const key = message.key?.toString();
    const raw = message.value?.toString();

    this.logger.log('Received notification message:', {
      topic,
      partition,
      key,
      offset: message.offset,
    });

    if (!raw) {
      return this.logger.warn('Received empty message', { topic, partition });
    }

    try {
      const n = JSON.parse(raw);
      const userId: string = n.userId;

      if (!userId) {
        this.logger.warn('Notification missing userId', { notification: n });
        return;
      }

      // Emit to Socket.IO
      this.gateway.emitToUser(userId, 'notification', {
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        createdAt: n.createdAt,
        channel: 'socket',
      });

      this.logger.log(`Relayed notification to user: ${userId}`);
    } catch (err) {
      this.logger.error(
        `Failed to process notification: ${err.message}`,
        err.stack,
      );
    }
  }
}
