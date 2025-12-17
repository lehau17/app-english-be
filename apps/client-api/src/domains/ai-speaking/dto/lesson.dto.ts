import {
  IsInt,
  IsString,
  IsArray,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { DifficultyLevel } from '@prisma/client';

export class GenerateLessonDto {
  @IsInt()
  @Min(1)
  @Max(5)
  level: number;

  @IsString()
  userId: string;

  @IsArray()
  @IsOptional()
  weakPhonemes?: string[]; // For remedial drills
}

export class LessonContentDto {
  id: string;
  level: number;
  levelName: string;
  type: 'word' | 'phrase' | 'sentence' | 'dialogue' | 'free';
  items: LessonItem[];
  passThreshold: number;
  reductionConfig?: DifficultyReductionConfig;
}

export interface LessonItem {
  content: string; // "cat", "My name is", etc.
  aiPrompt: string; // What AI says before user speaks
  expectedResponse: string[]; // Valid responses
  targetPhonemes?: string[]; // Phonemes to assess
  attemptNumber: number; // Current attempt (1-3)
  maxRetries: number; // Max allowed retries
}

export interface DifficultyReductionConfig {
  speechRate: number; // 0.8 = 20% slower
  showTranscript: boolean;
  allowRepeat: boolean;
  timeoutExtensionMs: number; // Extra thinking time
  simplifyWords: boolean;
}

export class TurnEvaluationDto {
  verdict: 'pass' | 'fail' | 'retry';
  weightedScore: number; // 0-100
  breakdown: {
    pronunciation: number; // 0-100
    relevance: number;
    fluency: number;
    completeness: number;
  };
  shouldReduceDifficulty: boolean;
  nextAction: 'continue' | 'retry' | 'reduce_difficulty' | 'next_level';
  feedback: string;
}

/**
 * Metrics from pronunciation/conversation evaluation
 * Used by lesson engine to calculate weighted scores
 */
export interface ConversationMetrics {
  pronunciationScore: number;
  relevanceScore: number;
  fluencyScore: number;
  completenessScore: number;
}
