import { DatabaseModule } from '@app/database';
import { Module, forwardRef } from '@nestjs/common';
import { AiSpeakingModule } from '../ai-speaking/ai-speaking.module';

// Controller
import { SpeakingPracticeController } from './speaking-practice.controller';

// Services
import { FeedbackGeneratorService } from './service/feedback-generator.service';
import { PronunciationScoringService } from './service/pronunciation-scoring.service';
import { SpeakingPracticeService } from './service/speaking-practice.service';
import { PlacementTestService } from './services/placement-test/placement-test.service';

// Repository
import { SpeakingPracticeRepository } from './repository/speaking-practice.repository';

/**
 * Speaking Practice Module
 * Progress-Based AI Speaking Practice for Children
 *
 * Features:
 * - Progress-Based architecture (no sessions)
 * - 5-level curriculum: Words → Phrases → Sentences → Dialogues → Free Talk
 * - MVP pronunciation scoring (Levenshtein + keywords + confidence)
 * - 100% automated AI decision (no human review)
 * - Child-friendly Vietnamese feedback
 * - Word-Based personalization + LLM analysis
 *
 * API Endpoints:
 * - GET  /speaking-practice/current    → Get progress
 * - GET  /speaking-practice/next-item  → Get next item
 * - POST /speaking-practice/submit     → Submit attempt
 * - GET  /speaking-practice/drills     → Get personalized drills
 */
@Module({
  imports: [
    DatabaseModule,
    // Import AiSpeakingModule for PronunciationAssessmentService
    forwardRef(() => AiSpeakingModule),
  ],
  controllers: [SpeakingPracticeController],
  providers: [
    // Core service
    SpeakingPracticeService,
    // Scoring & Feedback
    PronunciationScoringService,
    FeedbackGeneratorService,
    // Placement Test
    PlacementTestService,
    // Repository
    SpeakingPracticeRepository,
  ],
  exports: [
    SpeakingPracticeService,
    PronunciationScoringService,
    FeedbackGeneratorService,
    PlacementTestService,
  ],
})
export class SpeakingPracticeModule {}
