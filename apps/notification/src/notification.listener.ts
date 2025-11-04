import { PrismaRepository } from '@app/database';
import { KafkaConfigService, KafkaTopic } from '@app/shared';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { NotificationService } from './notification.service';

interface NotificationMessage {
  id?: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  createdAt?: string;
}

@Injectable()
export class NotificationListener implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private kafka: Kafka;
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly kafkaConfigService: KafkaConfigService,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaRepository,
  ) {
    this.kafka = new Kafka(this.kafkaConfigService.getConsumerConfig());
    this.consumer = this.kafka.consumer({
      groupId: 'notification-email-sender',
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
      this.logger.log('✅ Notification listener connected to Kafka');

      await this.consumer.subscribe({
        topics: [KafkaTopic.NOTIFICATION_SEND_OTP_CREATED, 'notifications'],
        fromBeginning: false,
      });
      this.logger.log(
        `✅ Subscribed to topics: ${KafkaTopic.NOTIFICATION_SEND_OTP_CREATED}, notifications`,
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

      this.logger.log('✅ Notification email consumer running');
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
      const notification: NotificationMessage = JSON.parse(raw);

      // Handle different notification types
      if (notification.type === 'send-otp') {
        await this.handleSendOtp(notification);
      } else if (
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

  private async handleSendOtp(notification: NotificationMessage) {
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
          `User ${notification.userId} has no email, skipping OTP email`,
        );
        return;
      }

      const otp = notification.data?.otp || notification.body;
      const userName = user.displayName || user.firstName || 'User';

      // Send email using generic sendEmail method
      await this.notificationService.sendEmail({
        to: [user.email],
        subject: 'Your OTP Code',
        template: './otp', // assuming you have an otp.pug template
        context: {
          name: userName,
          otp: otp,
        },
      });

      this.logger.log(`✅ Sent OTP email to ${user.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send OTP email: ${error.message}`,
        error.stack,
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
      const userName = user.displayName || user.firstName || 'User';

      await this.notificationService.sendEmail({
        to: [user.email],
        subject: 'Đặt lại mật khẩu - English Learning',
        template: './password-reset',
        context: {
          name: userName,
          token: token,
          resetLink: resetLink,
          expiresAt: new Date(expiresAt).toLocaleString('vi-VN'),
        },
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
