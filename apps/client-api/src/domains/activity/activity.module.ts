import { Module } from '@nestjs/common';
import { PrivateActivityController } from './controller';
import { ActivityService } from './service';
import { ActivityRepository } from './repository';

@Module({
  controllers: [PrivateActivityController],
  providers: [ActivityService, ActivityRepository],
})
export class ActivityModule {}
