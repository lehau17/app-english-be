import { Module } from '@nestjs/common';
import { PrivateNotificationController } from './controller';
import { NotificationRepository } from './repository';
import { NotificationService } from './service';

@Module({
    controllers: [PrivateNotificationController],
    providers: [NotificationService, NotificationRepository],
    exports: [NotificationService], // Export để các module khác có thể inject
})
export class NotificationModule { }
