import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VocabularyRepository } from '../repository/vocabulary.repository';

/**
 * Monitoring service for vocabulary-v2 domain
 * Detects data anomalies and maintains data integrity
 */
@Injectable()
export class VocabularyMonitoringService {
  private readonly logger = new Logger(VocabularyMonitoringService.name);

  constructor(private readonly repository: VocabularyRepository) {}

  /**
   * Hourly check for orphaned progress records
   * Detects user_vocabulary_progress entries pointing to non-existent vocabulary_term records
   */
  @Cron(CronExpression.EVERY_HOUR)
  async monitorOrphanedRecords(): Promise<void> {
    try {
      this.logger.log('Starting hourly orphaned records check...');

      const count = await this.repository.detectOrphanedProgress();

      if (count > 0) {
        this.logger.error(`Orphaned records detected: ${count} progress entries without valid terms`, {
          count,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.logger.log('Hourly orphaned records check completed: No orphans detected');
      }
    } catch (error) {
      this.logger.error(
        'Failed to execute orphaned records check',
        error instanceof Error ? error.stack : error,
      );
      // Don't throw - let cron continue running
    }
  }

  /**
   * Daily validation of stats consistency
   * Samples random users and checks for negative counts or mismatches
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async validateStatsConsistency(): Promise<void> {
    try {
      this.logger.log('Starting daily stats consistency validation...');

      // Check for negative counts in user progress
      const negativeCountsQuery = await this.repository.prisma.$queryRaw<
        { userId: string; termId: string; field: string; value: number }[]
      >`
        SELECT
          user_id as "userId",
          term_id as "termId",
          'correctCount' as field,
          correct_count as value
        FROM user_vocabulary_progress
        WHERE correct_count < 0
        UNION ALL
        SELECT
          user_id as "userId",
          term_id as "termId",
          'wrongCount' as field,
          wrong_count as value
        FROM user_vocabulary_progress
        WHERE wrong_count < 0
        UNION ALL
        SELECT
          user_id as "userId",
          term_id as "termId",
          'repetitions' as field,
          repetitions as value
        FROM user_vocabulary_progress
        WHERE repetitions < 0
      `;

      if (negativeCountsQuery.length > 0) {
        this.logger.error('Negative counts detected in user vocabulary progress', {
          count: negativeCountsQuery.length,
          samples: negativeCountsQuery.slice(0, 5),
          timestamp: new Date().toISOString(),
        });
      }

      // Check for mismatched total terms in user lists
      const mismatchedListsQuery = await this.repository.prisma.$queryRaw<
        { userId: string; listId: string; cachedTotal: number; actualTotal: number }[]
      >`
        SELECT
          uvl.user_id as "userId",
          uvl.list_id as "listId",
          uvl.total_terms as "cachedTotal",
          COUNT(vt.id) as "actualTotal"
        FROM user_vocabulary_list uvl
        LEFT JOIN vocabulary_unit vu ON vu.list_id = uvl.list_id
        LEFT JOIN vocabulary_term vt ON vt.unit_id = vu.id
        GROUP BY uvl.user_id, uvl.list_id, uvl.total_terms
        HAVING uvl.total_terms != COUNT(vt.id)
        LIMIT 10
      `;

      if (mismatchedListsQuery.length > 0) {
        this.logger.warn('Total terms mismatch detected in user vocabulary lists', {
          count: mismatchedListsQuery.length,
          samples: mismatchedListsQuery.map((item) => ({
            userId: item.userId,
            listId: item.listId,
            cachedTotal: item.cachedTotal,
            actualTotal: Number(item.actualTotal),
          })),
          timestamp: new Date().toISOString(),
        });
      }

      this.logger.log('Daily stats consistency validation completed', {
        negativeCountsFound: negativeCountsQuery.length,
        mismatchedListsFound: mismatchedListsQuery.length,
      });
    } catch (error) {
      this.logger.error(
        'Failed to execute stats consistency validation',
        error instanceof Error ? error.stack : error,
      );
      // Don't throw - let cron continue running
    }
  }
}
