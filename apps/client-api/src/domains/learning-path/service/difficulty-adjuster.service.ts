import { Injectable, Logger } from '@nestjs/common';
import { DifficultyLevel } from '@prisma/client';
import { ActivityVariantRepository } from '../repository';
import { PerformanceTrackerService } from './performance-tracker.service';

/**
 * Difficulty Adjuster Service
 * Dynamically adjusts activity difficulty based on recent performance
 * Targets "Goldilocks zone" of 70-80% success rate
 */
@Injectable()
export class DifficultyAdjusterService {
  private readonly logger = new Logger(DifficultyAdjusterService.name);

  // Target success rate range (Goldilocks zone)
  private readonly TARGET_MIN = 0.7; // 70%
  private readonly TARGET_MAX = 0.8; // 80%

  // Difficulty multipliers
  private readonly DIFFICULTY_SCALE = {
    beginner: 0.5,
    intermediate: 1.0,
    advanced: 1.5,
  };

  constructor(
    private readonly performanceTracker: PerformanceTrackerService,
    private readonly activityVariantRepo: ActivityVariantRepository,
  ) {}

  /**
   * Select next activity with appropriate difficulty
   * @param userId - User ID
   * @param learningPathId - Learning path ID
   * @param skill - Skill to practice
   * @param activityType - Type of activity (optional filter)
   */
  async selectNextActivity(
    userId: string,
    learningPathId: string,
    skill: string,
    activityType?: string,
  ): Promise<string | null> {
    try {
      // Get recent performance
      const performance =
        await this.performanceTracker.getRecentOverallPerformance(
          userId,
          learningPathId,
          5, // Last 5 activities
        );

      // Determine target difficulty
      const targetDifficulty = this.calculateTargetDifficulty(
        performance.successRate,
        performance.averageScore,
      );

      this.logger.debug(
        `Selecting activity for user ${userId}: successRate=${performance.successRate.toFixed(2)}, targetDifficulty=${targetDifficulty}`,
      );

      // Query activity variant pool
      const variant = await this.activityVariantRepo.findByFilters({
        skill,
        difficulty: targetDifficulty,
        activityType,
        limit: 1,
        minQualityScore: 0.7, // Only high-quality variants
      });

      if (variant.length === 0) {
        this.logger.warn(
          `No variant found for skill=${skill}, difficulty=${targetDifficulty}`,
        );
        return null;
      }

      return variant[0].id;
    } catch (error) {
      this.logger.error(
        `Failed to select next activity: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Calculate target difficulty based on performance
   */
  private calculateTargetDifficulty(
    successRate: number,
    averageScore: number,
  ): DifficultyLevel {
    // Too easy: success rate > 85%
    if (successRate > 0.85 || averageScore > 85) {
      return 'advanced';
    }

    // Too hard: success rate < 60%
    if (successRate < 0.6 || averageScore < 60) {
      return 'beginner';
    }

    // Goldilocks zone: 60-85% success rate
    return 'intermediate';
  }

  /**
   * Adjust difficulty for next step in learning path
   * @returns Recommended difficulty adjustment
   */
  async recommendDifficultyAdjustment(
    userId: string,
    learningPathId: string,
  ): Promise<{
    currentDifficulty: DifficultyLevel;
    recommendedDifficulty: DifficultyLevel;
    reason: string;
    shouldAdjust: boolean;
  }> {
    const performance =
      await this.performanceTracker.getRecentOverallPerformance(
        userId,
        learningPathId,
        5,
      );

    // Determine current difficulty from recent activities
    const currentDifficulty = this.inferCurrentDifficulty(
      performance.averageScore,
    );

    const recommendedDifficulty = this.calculateTargetDifficulty(
      performance.successRate,
      performance.averageScore,
    );

    let reason = '';
    let shouldAdjust = false;

    if (currentDifficulty !== recommendedDifficulty) {
      shouldAdjust = true;

      if (recommendedDifficulty === 'advanced') {
        reason = `Success rate ${(performance.successRate * 100).toFixed(0)}% - increase difficulty`;
      } else if (recommendedDifficulty === 'beginner') {
        reason = `Success rate ${(performance.successRate * 100).toFixed(0)}% - decrease difficulty`;
      } else {
        reason = `Success rate in Goldilocks zone - maintain moderate difficulty`;
      }
    } else {
      reason = `Current difficulty appropriate (success rate: ${(performance.successRate * 100).toFixed(0)}%)`;
    }

    return {
      currentDifficulty,
      recommendedDifficulty,
      reason,
      shouldAdjust,
    };
  }

  /**
   * Infer current difficulty level from average score
   */
  private inferCurrentDifficulty(averageScore: number): DifficultyLevel {
    if (averageScore >= 80) return 'beginner'; // Too easy
    if (averageScore >= 60) return 'intermediate'; // Just right
    return 'advanced'; // Too hard
  }

  /**
   * Get activity pool for specific difficulty and skill
   * Used to check if adjustment is possible
   */
  async getActivityPoolSize(
    skill: string,
    difficulty: DifficultyLevel,
    activityType?: string,
  ): Promise<number> {
    const variants = await this.activityVariantRepo.findByFilters({
      skill,
      difficulty,
      activityType,
      minQualityScore: 0.7,
    });

    return variants.length;
  }

  /**
   * Determine if user is in "flow state" (optimal challenge level)
   * Based on Csikszentmihalyi's flow theory
   */
  isInFlowState(
    successRate: number,
    averageScore: number,
  ): {
    inFlow: boolean;
    zone: 'boredom' | 'flow' | 'anxiety';
    recommendation: string;
  } {
    // Flow zone: 70-80% success rate
    if (successRate >= this.TARGET_MIN && successRate <= this.TARGET_MAX) {
      return {
        inFlow: true,
        zone: 'flow',
        recommendation:
          'Maintain current difficulty - user is in optimal learning zone',
      };
    }

    // Boredom zone: too easy
    if (successRate > this.TARGET_MAX) {
      return {
        inFlow: false,
        zone: 'boredom',
        recommendation: 'Increase difficulty - tasks are too easy',
      };
    }

    // Anxiety zone: too hard
    return {
      inFlow: false,
      zone: 'anxiety',
      recommendation: 'Decrease difficulty - tasks are too challenging',
    };
  }

  /**
   * Calculate difficulty multiplier for score adjustment
   * Used when mixing difficulties
   */
  getDifficultyMultiplier(difficulty: DifficultyLevel): number {
    return this.DIFFICULTY_SCALE[difficulty] || 1.0;
  }

  /**
   * Batch select activities for a learning path segment
   * Ensures variety while maintaining appropriate difficulty
   */
  async selectActivityBatch(
    userId: string,
    learningPathId: string,
    skill: string,
    count: number,
  ): Promise<string[]> {
    const variantIds: string[] = [];

    // Get performance to determine base difficulty
    const performance =
      await this.performanceTracker.getRecentOverallPerformance(
        userId,
        learningPathId,
        5,
      );

    const baseDifficulty = this.calculateTargetDifficulty(
      performance.successRate,
      performance.averageScore,
    );

    // Build variety: 70% base difficulty, 30% mixed
    const baseCount = Math.ceil(count * 0.7);
    const mixedCount = count - baseCount;

    // Get base difficulty activities
    const baseVariants = await this.activityVariantRepo.findByFilters({
      skill,
      difficulty: baseDifficulty,
      limit: baseCount,
      minQualityScore: 0.7,
    });

    variantIds.push(...baseVariants.map((v) => v.id));

    // Get mixed difficulty activities
    if (mixedCount > 0) {
      const otherDifficulties = this.getAdjacentDifficulties(baseDifficulty);

      for (const diff of otherDifficulties) {
        if (variantIds.length >= count) break;

        const mixedVariants = await this.activityVariantRepo.findByFilters({
          skill,
          difficulty: diff,
          limit: Math.ceil(mixedCount / otherDifficulties.length),
          minQualityScore: 0.7,
        });

        variantIds.push(...mixedVariants.map((v) => v.id));
      }
    }

    return variantIds.slice(0, count);
  }

  /**
   * Get adjacent difficulty levels for variety
   */
  private getAdjacentDifficulties(current: DifficultyLevel): DifficultyLevel[] {
    const levels: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced'];
    return levels.filter((l) => l !== current);
  }
}
