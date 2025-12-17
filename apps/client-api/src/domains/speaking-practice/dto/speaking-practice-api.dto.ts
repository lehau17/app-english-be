import {
  IsInt,
  IsString,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { DifficultyLevel } from '@prisma/client';

/**
 * DTOs for Speaking Practice REST API
 * Progress-Based Architecture (không Session-Based)
 */

// ============ Response DTOs ============

/**
 * User's speaking practice progress
 * Returned by GET /speaking-practice/current
 */
export class SpeakingPracticeProgressDto {
  id: string;
  userId: string;
  currentLevel: number;
  currentLevelName: string;
  currentLessonId: string | null;
  completedLessons: string[];
  totalLessonsCompleted: number;
  weakPhonemes: string[];
  streakDays: number;
  lastPracticedAt: Date | null;
  totalPracticeTimeMinutes: number;
  successRate: number; // 0-100%
  nextLevelUnlocked: boolean;
}

/**
 * Next practice item to speak
 * Returned by GET /speaking-practice/next-item
 */
export class NextPracticeItemDto {
  lessonId: string;
  lessonTitle: string;
  level: number;
  levelName: string;
  type: 'word' | 'phrase' | 'sentence' | 'dialogue' | 'free';
  itemIndex: number;
  totalItems: number;

  /**
   * Content to practice
   */
  content: string;

  /**
   * What AI says before user speaks
   */
  aiPrompt: string;

  /**
   * Reference text for pronunciation comparison
   */
  referenceText: string;

  /**
   * Target phonemes for this item (for scoring focus)
   */
  targetPhonemes: string[];

  /**
   * Score required to pass (0-100)
   */
  passThreshold: number;

  /**
   * Current attempt number (1-3)
   */
  attemptNumber: number;

  /**
   * Max retries allowed
   */
  maxRetries: number;

  /**
   * TTS audio URL for reference pronunciation
   */
  audioUrl?: string;

  /**
   * Whether difficulty has been reduced
   */
  difficultyReduced: boolean;
}

/**
 * Submission result after speaking
 * Returned by POST /speaking-practice/submit
 */
export class SubmitResultDto {
  /**
   * AI decision: accept (pass) or retry
   */
  decision: 'accept' | 'retry';

  /**
   * Combined pronunciation score (0-100)
   */
  score: number;

  /**
   * Detailed score breakdown
   */
  breakdown: {
    pronunciation: number;
    accuracy: number;
    fluency: number;
    completeness: number;
  };

  /**
   * User's transcript
   */
  transcript: string;

  /**
   * Child-friendly feedback (Vietnamese)
   */
  feedback: {
    text: string;
    audioUrl?: string;
    band: 'celebrate' | 'acknowledge' | 'support';
  };

  /**
   * Phonemes that need more practice
   */
  failedPhonemes: string[];

  /**
   * Words that were mispronounced
   */
  mispronounceWords: string[];

  /**
   * What to do next
   */
  nextAction: 'next_item' | 'retry' | 'next_lesson' | 'level_up' | 'completed';

  /**
   * Progress update
   */
  progressUpdate: {
    levelChanged: boolean;
    newLevel?: number;
    lessonCompleted: boolean;
    streakMaintained: boolean;
  };
}

/**
 * Personalized drill from LLM
 * Returned by GET /speaking-practice/drills
 */
export class PersonalizedDrillDto {
  id: string;
  generatedAt: Date;

  /**
   * LLM analysis summary (Vietnamese)
   */
  analysis: string;

  /**
   * Target words for practice
   */
  targetWords: string[];

  /**
   * Practice sentences containing target words
   */
  targetSentences: string[];

  /**
   * Weak phonemes identified
   */
  targetPhonemes: string[];

  /**
   * Priority (1 = highest)
   */
  priority: number;

  /**
   * Drill status
   */
  status: 'pending' | 'in_progress' | 'completed';
}

// ============ Request DTOs ============

/**
 * Request to start/continue practice
 * Used by GET /speaking-practice/next-item
 */
export class GetNextItemDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  level?: number; // Optional: override current level

  @IsString()
  @IsOptional()
  lessonId?: string; // Optional: specific lesson

  @IsBoolean()
  @IsOptional()
  includeRemedial?: boolean; // Include remedial drills for weak phonemes
}

/**
 * Request to submit practice attempt
 * Used by POST /speaking-practice/submit
 */
export class SubmitAttemptDto {
  @IsString()
  lessonId: string;

  @IsInt()
  @Min(0)
  itemIndex: number;

  @IsString()
  referenceText: string;

  /**
   * Audio file (Buffer or base64)
   * Will be processed by multipart handler
   */
  audioBase64?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(3)
  attemptNumber?: number;
}

/**
 * Request to get personalized drills
 * Used by GET /speaking-practice/drills
 */
export class GetDrillsDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(10)
  limit?: number;

  @IsString()
  @IsOptional()
  status?: 'pending' | 'in_progress' | 'completed';
}
