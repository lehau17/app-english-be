import { Module } from '@nestjs/common';
import { PrivateNotificationController } from './controller';
import { NotificationService } from './service';
import { NotificationRepository } from './repository';

@Module({
  controllers: [PrivateNotificationController],
  providers: [NotificationService, NotificationRepository],
})
export class NotificationModule {}
