import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { RedisModule } from '@app/shared';
import { TopicsController } from './controller/topics.controller';
import { TopicsService } from './service/topics.service';
import { TopicsRepository } from './repository/topics.repository';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [TopicsController],
  providers: [TopicsService, TopicsRepository],
  exports: [TopicsService, TopicsRepository],
})
export class TopicsModule {}
