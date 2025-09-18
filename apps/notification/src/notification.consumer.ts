import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PrismaRepository } from '@app/database';
import { NotificationService as MailService } from './notification.service';

@Controller()
export class NotificationConsumer {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly mailService: MailService,
  ) {}

  // Consume Kafka topic 'notifications'
  @EventPattern('notifications')
  async handleNotification(@Payload() message: any) {
    try {
      const value = (message && (message.value || message)) as any;
      // Value is expected to be the Notification record payload
      const n = typeof value === 'string' ? JSON.parse(value) : value;
      const userId: string = n.userId;

      // Fetch user email (if needed for email channel)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, displayName: true },
      });

      const channel: string = n.channel || 'socket';
      if (channel === 'email') {
        const to: string[] | undefined = user?.email ? [user.email] : undefined;
        await this.mailService.sendEmail({
          subject: n.title || 'Thông báo',
          template: 'notification',
          context: {
            title: n.title,
            body: n.body,
            user: { id: user?.id, name: user?.displayName || user?.email },
          },
          to,
        });
      } else {
        // Non-email channels are handled by client-api via Socket.IO.
        // No action needed here.
      }
    } catch (e) {
      this.logger.error('Failed to process notification event', e as any);
    }
  }
}
