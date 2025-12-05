import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VocabularyStatsService } from './vocabulary-stats.service';

/**
 * Cron job to automatically update vocabulary unit termCount fields
 * Runs every minute to sync cached counts with actual term counts
 */
@Injectable()
export class VocabularyStatsCron {
  private readonly logger = new Logger(VocabularyStatsCron.name);

  constructor(private readonly statsService: VocabularyStatsService) {}

  /**
   * Update termCount for all vocabulary units
   * Runs every minute: * * * * *
   */
  @Cron('* * * * *')
  async updateUnitTermCounts(): Promise<void> {
    try {
      this.logger.log('Starting scheduled vocabulary unit termCount update...');

      await this.statsService.updateAllUnitTermCounts();

      this.logger.log('Scheduled vocabulary unit termCount update completed');
    } catch (error) {
      this.logger.error(
        'Failed to execute scheduled vocabulary unit termCount update',
        error instanceof Error ? error.stack : error,
      );
      // Don't throw - let cron continue running
    }
  }
}



