import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { NotificationEventsConsumer } from './notification.consumer';

@Module({
  providers: [EventsGateway, NotificationEventsConsumer],
  controllers: [NotificationEventsConsumer],
})
export class EventsModule {}
