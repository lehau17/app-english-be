import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { TopicsService } from './topics.service';
import { TopicTrendingCron } from './topic-trending.cron';

@Module({
  imports: [DatabaseModule],
  providers: [TopicsService, TopicTrendingCron],
  exports: [TopicsService],
})
export class TopicsModule {}
