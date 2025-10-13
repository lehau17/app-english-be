import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SuggestionEngineService } from './suggestion-engine.service';

@Injectable()
export class SuggestionCron {
  private readonly logger = new Logger(SuggestionCron.name);

  constructor(private readonly suggestionEngineService: SuggestionEngineService) {}

  @Cron('0 2 * * *') // Runs every day at 2:00 AM
  async handleCron() {
    this.logger.log('Triggering daily suggestion generation...');
    try {
      await this.suggestionEngineService.analyzeAndGenerateSuggestions();
      this.logger.log('Successfully completed daily suggestion generation.');
    } catch (error) {
      this.logger.error('Failed to generate daily suggestions.', error.stack);
    }
  }
}