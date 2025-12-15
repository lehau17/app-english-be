import { DatabaseModule } from '@app/database';
import { GeminiService, SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { DrillRetrievalService } from './drill-retrieval.service';
import { MispronounceWordListener } from './mispronounce-word.listener';
import { PersonalizationLLMService } from './personalization-llm.service';
import { SRSSpeakingService } from './srs-speaking.service';

@Module({
  imports: [DatabaseModule, SharedModule],
  providers: [
    MispronounceWordListener,
    PersonalizationLLMService,
    DrillRetrievalService,
    SRSSpeakingService,
    GeminiService
  ],
  exports: [PersonalizationLLMService, DrillRetrievalService, SRSSpeakingService],
})
export class SpeakingPracticeModule {}
