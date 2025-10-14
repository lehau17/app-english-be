import { Module } from '@nestjs/common';
import { SuggestionEngineService } from './suggestion-engine.service';
import { SuggestionCron } from './suggestion.cron';

@Module({
  providers: [SuggestionEngineService, SuggestionCron],
  exports: [SuggestionEngineService],
})
export class SuggestionEngineModule {}