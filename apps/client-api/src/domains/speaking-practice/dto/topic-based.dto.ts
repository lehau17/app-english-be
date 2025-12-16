import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

/**
 * DTOs for Topic-Based Speaking Practice API
 * Replaces linear level progression with topic categories
 */

// ============ Response DTOs ============

/**
 * Single topic with progress summary
 */
export class TopicWithProgress {
  category: string;
  totalLessons: number;
  completedLessons: number;
  progress: number; // percentage 0-100
  avgScore: number;
  lastPracticedAt: Date | null;
  nextReviewDate: Date | null;
  tiers: {
    easy: { total: number; completed: number };
    medium: { total: number; completed: number };
    hard: { total: number; completed: number };
  };
}

/**
 * List of all topics with progress
 * Returned by GET /speaking-practice/topics
 */
export class TopicListResponseDto {
  topics: TopicWithProgress[];
}

/**
 * Single lesson with progress
 */
export class LessonWithProgress {
  id: string;
  title: string;
  difficultyTier: number;
  type: string;
  isCompleted: boolean;
  score: number | null;
  lastAttemptedAt: Date | null;
}

/**
 * Lessons in a category with progress
 * Returned by GET /speaking-practice/topics/:category/lessons
 */
export class LessonsByCategoryResponseDto {
  category: string;
  lessons: LessonWithProgress[];
}

/**
 * Recommended lesson based on performance
 */
export class LessonRecommendation {
  lessonId: string;
  title: string;
  category: string;
  difficultyTier: number;
  reason: string; // Why recommended
  priority: number; // 1-5
}

/**
 * Topic progress update after lesson completion
 */
export class TopicProgressSummary {
  category: string;
  completedCount: number;
  totalInCategory: number;
  avgScore: number;
  tierProgress: {
    easy: { total: number; completed: number };
    medium: { total: number; completed: number };
    hard: { total: number; completed: number };
  };
  nextReviewDate: Date | null;
}

// ============ Request DTOs ============

/**
 * Query parameters for recommendations
 * Used by GET /speaking-practice/recommendations
 */
export class GetRecommendationsDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(20)
  limit?: number;
}

/**
 * Query parameters for category lessons
 * Used by GET /speaking-practice/topics/:category/lessons
 */
export class GetLessonsByCategoryDto {
  @IsString()
  category: string;
}
