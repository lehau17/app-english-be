import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ParentChildModule } from '../parent-child';
import {
  ParentChildLinkRequestRepository,
  ParentChildRepository,
} from '../parent-child/repository';
import { ParentChildService } from '../parent-child/service/parent-child.service';
import {
  AdminParentController,
  PrivateParentController,
  PrivateParentTransactionController,
} from './controller';
import {
  AdminParentService,
  ParentService,
  ParentTransactionService,
} from './service';
import { ParentNotificationService } from './service/parent-notification.service';

@Module({
  imports: [DatabaseModule, ParentChildModule],
  controllers: [
    PrivateParentController,
    AdminParentController,
    PrivateParentTransactionController,
  ],
  providers: [
    ParentService,
    AdminParentService,
    ParentChildService,
    ParentChildRepository,
    ParentNotificationService,
    ParentTransactionService,
    ParentChildLinkRequestRepository,
  ],
  exports: [
    ParentService,
    AdminParentService,
    ParentChildService,
    ParentChildRepository,
    ParentNotificationService,
    ParentTransactionService,
  ],
})
export class ParentModule {}
