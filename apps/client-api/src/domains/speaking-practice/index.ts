/**
 * Speaking Practice Domain Exports
 * Progress-Based AI Speaking Practice for Children
 */

// Module
export { SpeakingPracticeModule } from './speaking-practice.module';

// Services
export { SpeakingPracticeService } from './service/speaking-practice.service';
export { PronunciationScoringService } from './service/pronunciation-scoring.service';
export { FeedbackGeneratorService } from './service/feedback-generator.service';

// Repository
export { SpeakingPracticeRepository } from './repository/speaking-practice.repository';

// Controller
export { SpeakingPracticeController } from './speaking-practice.controller';

// DTOs - Pronunciation Scoring
export {
  AssessWithScoringDto,
  ScoringResultDto,
  EnhancedPronunciationFeedbackDto,
  ScoreBreakdownDto,
} from './dto/pronunciation-scoring.dto';

// DTOs - Feedback
export {
  PronunciationError,
  PhonemeFeedback,
  FeedbackBand,
  FeedbackResult,
  GenerateFeedbackDto,
} from './dto/feedback.dto';

// DTOs - API
export {
  SpeakingPracticeProgressDto,
  NextPracticeItemDto,
  SubmitResultDto,
  PersonalizedDrillDto,
  GetNextItemDto,
  SubmitAttemptDto,
  GetDrillsDto,
} from './dto/speaking-practice-api.dto';

// Utilities
export {
  levenshteinDistance,
  matchKeywords,
  calculateCombinedScore,
  extractFailedPhonemes,
} from './service/pronunciation-scoring.util';
