import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TopicsService } from './topics.service';

@Injectable()
export class TopicTrendingCron {
  private readonly logger = new Logger(TopicTrendingCron.name);

  constructor(private readonly topicsService: TopicsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateTrending() {
    this.logger.log('Starting daily topic trending calculation...');

    try {
      await this.topicsService.calculateTrending();
      this.logger.log('Topic trending calculation completed successfully');
    } catch (error) {
      this.logger.error('Topic trending calculation failed', error.stack);
    }
  }
}
