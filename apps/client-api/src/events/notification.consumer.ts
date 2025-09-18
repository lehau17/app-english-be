import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EventsGateway } from './events.gateway';

@Controller()
export class NotificationEventsConsumer {
  private readonly logger = new Logger(NotificationEventsConsumer.name);

  constructor(private readonly gateway: EventsGateway) {}

  @EventPattern('notifications')
  async handleNotification(@Payload() message: any) {
    try {
      const value = (message && (message.value || message)) as any;
      const n = typeof value === 'string' ? JSON.parse(value) : value;
      const userId: string = n.userId;
      if (!userId) return;
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
    } catch (e) {
      this.logger.error('Failed to relay socket notification', e as any);
    }
  }
}

