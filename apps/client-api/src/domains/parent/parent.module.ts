import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ParentChildModule } from '../parent-child';
import { ParentChildRepository } from '../parent-child/repository';
import { ParentChildService } from '../parent-child/service/parent-child.service';
import { AdminParentController, PrivateParentController } from './controller';
import { AdminParentService, ParentService } from './service';
import { ParentNotificationService } from './service/parent-notification.service';

@Module({
  imports: [DatabaseModule, ParentChildModule],
  controllers: [PrivateParentController, AdminParentController],
  providers: [
    ParentService,
    AdminParentService,
    ParentChildService,
    ParentChildRepository,
    ParentNotificationService,
  ],
  exports: [
    ParentService,
    AdminParentService,
    ParentChildService,
    ParentChildRepository,
    ParentNotificationService,
  ],
})
export class ParentModule {}
