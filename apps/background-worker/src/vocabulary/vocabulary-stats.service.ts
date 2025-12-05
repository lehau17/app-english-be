import { Injectable, Logger } from '@nestjs/common';
import { VocabularyRepository } from './vocabulary.repository';

@Injectable()
export class VocabularyStatsService {
  private readonly logger = new Logger(VocabularyStatsService.name);

  constructor(private readonly vocabularyRepository: VocabularyRepository) {}

  /**
   * Update termCount for all vocabulary units based on actual term counts
   */
  async updateAllUnitTermCounts(): Promise<void> {
    try {
      this.logger.log('Starting vocabulary unit termCount update...');

      const result = await this.vocabularyRepository.updateAllUnitTermCounts();

      this.logger.log(
        `Vocabulary unit termCount update completed: ${result.unitsUpdated} units updated, ${result.totalTerms} total terms`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to update vocabulary unit termCounts',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}



