import { Injectable } from '@nestjs/common';
import { MispronounceWord } from '@prisma/client';
import { addDays, addHours } from 'date-fns';

/**
 * SRS Speaking Service
 * Implements SM-2 Algorithm for spaced repetition of mispronounced words
 *
 * Quality scale (adapted for pronunciation):
 * - 5: Perfect pronunciation (hoàn hảo)
 * - 4: Correct but slight hesitation (đúng nhưng chần chừ)
 * - 3: Correct with difficulty (đúng nhưng khó)
 * - 2: Wrong pronunciation but remembered word (sai phát âm)
 * - 1: Wrong, struggled (sai hoàn toàn)
 * - 0: Complete failure (không phát âm được)
 */
@Injectable()
export class SRSSpeakingService {
  /**
   * Calculate next review schedule based on SM-2 algorithm
   * @param word Current mispronounce word data
   * @param quality Rating 0-5 (based on pronunciation accuracy)
   * @returns Updated SRS data for the word
   */
  calculateNextReview(
    word: Partial<MispronounceWord> | null,
    quality: number,
  ): {
    easeFactor: number;
    interval: number;
    repetitions: number;
    nextReviewDate: Date;
    status: 'new' | 'learning' | 'review' | 'mastered';
    lastReviewedAt: Date;
  } {
    // Initialize defaults for new words
    let easeFactor = word?.easeFactor ?? 2.5;
    let interval = word?.interval ?? 1;
    let repetitions = word?.repetitions ?? 0;

    const now = new Date();

    // SM-2 Algorithm
    if (quality >= 3) {
      // Correct pronunciation
      if (repetitions === 0) {
        interval = 1; // 1 day
      } else if (repetitions === 1) {
        interval = 6; // 6 days
      } else {
        interval = Math.round(interval * easeFactor);
      }

      repetitions += 1;

      // Update ease factor
      easeFactor = Math.max(
        1.3,
        easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
      );

      // Determine status based on progress
      let status: 'new' | 'learning' | 'review' | 'mastered' = 'learning';
      if (repetitions >= 5 && interval >= 21) {
        status = 'mastered'; // Mastered after 5+ correct reviews with 21+ day interval
      } else if (repetitions >= 2) {
        status = 'review'; // In review phase
      }

      return {
        easeFactor: Number(easeFactor.toFixed(2)),
        interval,
        repetitions,
        nextReviewDate: addDays(now, interval),
        status,
        lastReviewedAt: now,
      };
    } else {
      // Wrong pronunciation - reset but keep some ease factor reduction
      easeFactor = Math.max(1.3, easeFactor - 0.2);

      // For first wrong answer, review in 10 minutes
      // For subsequent wrong answers, review in 1 day
      const reviewDelay =
        repetitions === 0 ? addHours(now, 0.1667) : addDays(now, 1);

      return {
        easeFactor: Number(easeFactor.toFixed(2)),
        interval: 1,
        repetitions: 0, // Reset repetitions
        nextReviewDate: reviewDelay,
        status: 'learning',
        lastReviewedAt: now,
      };
    }
  }

  /**
   * Get quality rating based on pronunciation score
   * Maps pronunciation score (0-100) to SM-2 quality (0-5)
   */
  getQualityFromScore(score: number): number {
    if (score >= 90) return 5; // Perfect
    if (score >= 80) return 4; // Good with slight issues
    if (score >= 70) return 3; // Acceptable
    if (score >= 50) return 2; // Poor but recognizable
    if (score >= 30) return 1; // Very poor
    return 0; // Failed
  }

  /**
   * Calculate quality for mispronounced word (always low quality since it's an error)
   * When a word is marked as mispronounced, quality is 0-2 based on error severity
   */
  getQualityForMispronounce(errorType?: string): number {
    // All mispronounced words get low quality
    switch (errorType) {
      case 'phoneme_substitution':
        return 2; // Wrong sound but attempted
      case 'phoneme_deletion':
        return 1; // Missing sound
      case 'phoneme_addition':
        return 1; // Added extra sound
      case 'stress_error':
        return 2; // Stress placement issue
      case 'intonation_error':
        return 2; // Intonation issue
      default:
        return 1; // Default low quality
    }
  }

  /**
   * Check if a word is due for review
   */
  isDueForReview(word: MispronounceWord): boolean {
    if (!word.nextReviewDate) return true;
    return new Date(word.nextReviewDate) <= new Date();
  }

  /**
   * Get review priority score (lower = higher priority)
   * Words that are more overdue get higher priority
   */
  getReviewPriority(word: MispronounceWord): number {
    if (!word.nextReviewDate) return 0; // New words have highest priority

    const now = new Date().getTime();
    const dueDate = new Date(word.nextReviewDate).getTime();
    const daysPastDue = (now - dueDate) / (1000 * 60 * 60 * 24);

    // More overdue = lower priority number = higher priority
    return -daysPastDue;
  }
}
