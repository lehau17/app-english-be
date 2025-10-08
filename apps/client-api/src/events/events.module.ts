import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { NotificationListener } from './notification.listener';

@Module({
  providers: [EventsGateway, NotificationListener],
  exports: [EventsGateway],
})
export class EventsModule {}
