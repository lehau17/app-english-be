import { Injectable, Logger } from '@nestjs/common';
import { SkillProgressRepository } from '../repository';

/**
 * SRS Scheduler Service implementing SM-2 algorithm
 * Calculates next review intervals for spaced repetition
 */
@Injectable()
export class SRSSchedulerService {
  private readonly logger = new Logger(SRSSchedulerService.name);

  // SM-2 algorithm constants
  private readonly MIN_EASE_FACTOR = 1.3;
  private readonly DEFAULT_EASE_FACTOR = 2.5;
  private readonly MIN_INTERVAL = 1; // 1 day minimum

  constructor(private readonly skillProgressRepo: SkillProgressRepository) {}

  /**
   * Calculate SM-2 interval based on quality rating
   * @param quality - Quality rating (0-5):
   *   0: Complete blackout
   *   1: Incorrect response, correct answer seemed easy to recall
   *   2: Incorrect response, correct answer seemed hard to recall
   *   3: Correct response, with serious difficulty
   *   4: Correct response, with some hesitation
   *   5: Perfect response
   */
  calculateSM2(
    currentEaseFactor: number,
    currentInterval: number,
    quality: number,
  ): {
    easeFactor: number;
    interval: number;
    repetitions: number;
  } {
    // Validate quality (0-5)
    if (quality < 0 || quality > 5) {
      throw new Error('Quality must be between 0 and 5');
    }

    let easeFactor = currentEaseFactor;
    let interval = currentInterval;
    let repetitions = 0;

    // Calculate new ease factor
    easeFactor =
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    // Ensure ease factor doesn't go below minimum
    if (easeFactor < this.MIN_EASE_FACTOR) {
      easeFactor = this.MIN_EASE_FACTOR;
    }

    // Calculate interval based on quality
    if (quality < 3) {
      // Incorrect response - reset to minimum interval
      interval = this.MIN_INTERVAL;
      repetitions = 0;
    } else {
      // Correct response - increase interval
      if (interval === 1) {
        interval = 6; // First correct review: 6 days
      } else {
        interval = Math.ceil(interval * easeFactor);
      }
      repetitions = repetitions + 1;
    }

    return {
      easeFactor: Math.round(easeFactor * 100) / 100, // Round to 2 decimals
      interval,
      repetitions,
    };
  }

  /**
   * Update skill progress after practice session
   */
  async updateAfterPractice(
    userId: string,
    skill: string,
    quality: number,
    score: number,
  ): Promise<void> {
    try {
      // Find or create skill progress
      const progress = await this.skillProgressRepo.findOrCreate(userId, skill);

      // Calculate new SRS parameters
      const { easeFactor, interval, repetitions } = this.calculateSM2(
        progress.easeFactor,
        progress.interval,
        quality,
      );

      // Calculate next review date
      const nextReviewAt = new Date();
      nextReviewAt.setDate(nextReviewAt.getDate() + interval);

      // Update counters
      const isCorrect = quality >= 3;
      const correctCount = progress.correctCount + (isCorrect ? 1 : 0);
      const incorrectCount = progress.incorrectCount + (isCorrect ? 0 : 1);
      const totalAttempts = progress.totalAttempts + 1;

      // Calculate mastery score (0-100)
      const masteryScore = this.calculateMasteryScore(
        correctCount,
        totalAttempts,
        easeFactor,
        repetitions,
      );

      // Determine level based on mastery score
      const level = this.determineLevelFromMastery(masteryScore);

      // Calculate confidence (0-1)
      const confidence = this.calculateConfidence(
        correctCount,
        totalAttempts,
        repetitions,
      );

      // Update skill progress
      await this.skillProgressRepo.updateProgress(userId, skill, {
        easeFactor,
        interval,
        repetitions,
        correctCount,
        incorrectCount,
        totalAttempts,
        masteryScore,
        level,
        confidence,
        nextReviewAt,
      });

      this.logger.debug(
        `Updated SRS for user ${userId}, skill ${skill}: interval=${interval}d, mastery=${masteryScore}%`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update SRS after practice: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Calculate mastery score (0-100) based on performance metrics
   */
  private calculateMasteryScore(
    correctCount: number,
    totalAttempts: number,
    easeFactor: number,
    repetitions: number,
  ): number {
    if (totalAttempts === 0) return 0;

    // Success rate (0-1)
    const successRate = correctCount / totalAttempts;

    // Ease factor contribution (normalized to 0-1)
    const easeFactorContribution =
      (easeFactor - this.MIN_EASE_FACTOR) / (3.0 - this.MIN_EASE_FACTOR);

    // Repetitions contribution (capped at 10 repetitions)
    const repetitionsContribution = Math.min(repetitions / 10, 1);

    // Weighted score
    const masteryScore =
      successRate * 0.5 +
      easeFactorContribution * 0.3 +
      repetitionsContribution * 0.2;

    return Math.round(masteryScore * 100);
  }

  /**
   * Determine proficiency level from mastery score
   */
  private determineLevelFromMastery(masteryScore: number): string {
    if (masteryScore >= 80) return 'advanced';
    if (masteryScore >= 50) return 'intermediate';
    return 'beginner';
  }

  /**
   * Calculate confidence level (0-1)
   */
  private calculateConfidence(
    correctCount: number,
    totalAttempts: number,
    repetitions: number,
  ): number {
    if (totalAttempts === 0) return 0.5;

    const successRate = correctCount / totalAttempts;
    const repetitionBonus = Math.min(repetitions * 0.05, 0.2); // Max 20% bonus

    const confidence = Math.min(successRate + repetitionBonus, 1.0);
    return Math.round(confidence * 100) / 100; // Round to 2 decimals
  }

  /**
   * Get skills due for review
   */
  async getDueSkills(userId: string, limit?: number): Promise<any[]> {
    return this.skillProgressRepo.findDueForReview(userId, limit);
  }

  /**
   * Convert score (0-100) to quality rating (0-5)
   * This helps integrate with existing scoring systems
   */
  scoreToQuality(score: number): number {
    if (score >= 95) return 5; // Perfect
    if (score >= 80) return 4; // Good with minor hesitation
    if (score >= 60) return 3; // Correct but difficult
    if (score >= 40) return 2; // Incorrect but close
    if (score >= 20) return 1; // Incorrect but recalled answer
    return 0; // Complete failure
  }

  /**
   * Bulk update SRS for multiple skills (optimization for batch operations)
   */
  async batchUpdateAfterPractice(
    userId: string,
    updates: Array<{ skill: string; quality: number; score: number }>,
  ): Promise<void> {
    for (const update of updates) {
      await this.updateAfterPractice(
        userId,
        update.skill,
        update.quality,
        update.score,
      );
    }
  }
}
