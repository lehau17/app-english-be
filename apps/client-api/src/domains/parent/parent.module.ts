import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ParentChildModule } from '../parent-child';
import { ParentChildRepository } from '../parent-child/repository';
import { ParentChildService } from '../parent-child/service/parent-child.service';
import { PrivateParentController } from './controller';
import { ParentService } from './service';
import { ParentNotificationService } from './service/parent-notification.service';

@Module({
  imports: [DatabaseModule, ParentChildModule],
  controllers: [PrivateParentController],
  providers: [ParentService, ParentChildService, ParentChildRepository, ParentNotificationService],
  exports: [ParentService, ParentChildService, ParentChildRepository, ParentNotificationService],
})
export class ParentModule {}
