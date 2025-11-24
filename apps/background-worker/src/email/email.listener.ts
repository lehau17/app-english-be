import { PrismaRepository } from '@app/database';
import { KafkaConfigService } from '@app/shared';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { EmailService } from './email.service';

interface NotificationMessage {
  id?: string;
  userId: string;
  channel?: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  priority?: string;
  createdAt?: string;
}

@Injectable()
export class EmailListener implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private kafka: Kafka;
  private readonly logger = new Logger(EmailListener.name);

  constructor(
    private readonly kafkaConfigService: KafkaConfigService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaRepository,
  ) {
    this.kafka = new Kafka(this.kafkaConfigService.getConsumerConfig());
    this.consumer = this.kafka.consumer({
      groupId: 'background-worker-email',
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
      this.logger.log('✅ Email listener connected to Kafka');

      await this.consumer.subscribe({
        topics: ['notifications'],
        fromBeginning: false,
      });
      this.logger.log('✅ Subscribed to topic: notifications');

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

      this.logger.log('✅ Email consumer running');
    } catch (error) {
      this.logger.error('Failed to initialize email listener', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
      this.logger.log('Email listener disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect email listener', error);
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
      const notification: NotificationMessage = JSON.parse(raw);

      // Only process email notifications
      if (notification.channel !== 'email') {
        this.logger.debug(
          `Skipping non-email notification: channel=${notification.channel}`,
        );
        return;
      }

      // Handle password reset emails
      if (
        notification.type === 'system' &&
        notification.data?.action === 'password_reset'
      ) {
        await this.handlePasswordReset(notification);
      } else {
        this.logger.log(
          `Notification type "${notification.type}" - no email action needed`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to process notification: ${err.message}`,
        err.stack,
      );
    }
  }

  private async handlePasswordReset(notification: NotificationMessage) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: notification.userId },
        select: {
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
        },
      });

      if (!user?.email) {
        this.logger.warn(
          `User ${notification.userId} has no email, skipping password reset email`,
        );
        return;
      }

      const { token, resetLink, expiresAt } = notification.data;
      const userName =
        user.displayName || user.firstName || user.lastName || 'User';

      await this.emailService.sendPasswordResetEmail({
        to: user.email,
        name: userName,
        token: token,
        resetLink: resetLink,
        expiresAt: expiresAt,
      });

      this.logger.log(`✅ Sent password reset email to ${user.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email: ${error.message}`,
        error.stack,
      );
    }
  }
}









