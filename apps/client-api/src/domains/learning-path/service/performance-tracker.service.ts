import { Injectable, Logger } from '@nestjs/common';
import { PrismaRepository } from '@app/database';

/**
 * Performance Tracker Service
 * Tracks user performance across learning path activities
 * Used by difficulty adjuster to analyze recent performance
 */
@Injectable()
export class PerformanceTrackerService {
  private readonly logger = new Logger(PerformanceTrackerService.name);

  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Track activity completion
   */
  async trackCompletion(
    userId: string,
    stepId: string,
    data: {
      score: number;
      timeSpent: number; // seconds
      success: boolean;
    },
  ): Promise<void> {
    try {
      // Update step record
      await this.prisma.learningPathStep.update({
        where: { id: stepId },
        data: {
          score: data.score,
          timeSpent: data.timeSpent,
          completedAt: new Date(),
          attemptCount: {
            increment: 1,
          },
          lastAttemptedAt: new Date(),
          status: data.success ? 'completed' : 'in_progress',
        },
      });

      this.logger.debug(
        `Tracked completion for user ${userId}, step ${stepId}: score=${data.score}, success=${data.success}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to track completion: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get recent performance for a user on a specific skill
   * @param userId - User ID
   * @param skill - Skill identifier
   * @param limit - Number of recent activities to analyze
   */
  async getRecentPerformance(
    userId: string,
    skill: string,
    limit: number = 5,
  ): Promise<{
    successRate: number;
    averageScore: number;
    averageTimeSpent: number;
    totalAttempts: number;
    recentActivities: Array<{
      stepId: string;
      score: number;
      success: boolean;
      timeSpent: number;
      completedAt: Date;
    }>;
  }> {
    try {
      // Query recent steps for this skill
      const steps = await this.prisma.learningPathStep.findMany({
        where: {
          learningPath: {
            userId,
          },
          completedAt: {
            not: null,
          },
          // Filter by skill (if variants have skill metadata)
          OR: [
            {
              variant: {
                skill,
              },
            },
            {
              activity: {
                // Assuming activities have skill tags in metadata
                metadata: {
                  path: ['skills'],
                  array_contains: skill,
                },
              },
            },
          ],
        },
        orderBy: {
          completedAt: 'desc',
        },
        take: limit,
        include: {
          activity: true,
          variant: true,
        },
      });

      if (steps.length === 0) {
        return {
          successRate: 0,
          averageScore: 0,
          averageTimeSpent: 0,
          totalAttempts: 0,
          recentActivities: [],
        };
      }

      // Calculate metrics
      const totalScore = steps.reduce((sum, step) => sum + (step.score || 0), 0);
      const totalTimeSpent = steps.reduce(
        (sum, step) => sum + (step.timeSpent || 0),
        0,
      );
      const successfulSteps = steps.filter((step) => (step.score || 0) >= 60);

      const recentActivities = steps.map((step) => ({
        stepId: step.id,
        score: step.score || 0,
        success: (step.score || 0) >= 60,
        timeSpent: step.timeSpent || 0,
        completedAt: step.completedAt!,
      }));

      return {
        successRate: successfulSteps.length / steps.length,
        averageScore: Math.round(totalScore / steps.length),
        averageTimeSpent: Math.round(totalTimeSpent / steps.length),
        totalAttempts: steps.length,
        recentActivities,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get recent performance: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get recent performance across all skills for difficulty adjustment
   * @param userId - User ID
   * @param learningPathId - Learning path ID
   * @param limit - Number of recent activities
   */
  async getRecentOverallPerformance(
    userId: string,
    learningPathId: string,
    limit: number = 5,
  ): Promise<{
    successRate: number;
    averageScore: number;
    trend: 'improving' | 'stable' | 'declining';
    recentActivities: Array<{
      stepId: string;
      score: number;
      success: boolean;
      completedAt: Date;
    }>;
  }> {
    try {
      const steps = await this.prisma.learningPathStep.findMany({
        where: {
          learningPathId,
          completedAt: {
            not: null,
          },
        },
        orderBy: {
          completedAt: 'desc',
        },
        take: limit,
      });

      if (steps.length === 0) {
        return {
          successRate: 0,
          averageScore: 0,
          trend: 'stable',
          recentActivities: [],
        };
      }

      const totalScore = steps.reduce((sum, step) => sum + (step.score || 0), 0);
      const successfulSteps = steps.filter((step) => (step.score || 0) >= 60);

      const recentActivities = steps.map((step) => ({
        stepId: step.id,
        score: step.score || 0,
        success: (step.score || 0) >= 60,
        completedAt: step.completedAt!,
      }));

      // Calculate trend
      const trend = this.calculateTrend(steps.map((s) => s.score || 0));

      return {
        successRate: successfulSteps.length / steps.length,
        averageScore: Math.round(totalScore / steps.length),
        trend,
        recentActivities,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get recent overall performance: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Calculate performance trend
   */
  private calculateTrend(scores: number[]): 'improving' | 'stable' | 'declining' {
    if (scores.length < 3) return 'stable';

    // Split into first half and second half
    const midpoint = Math.floor(scores.length / 2);
    const firstHalf = scores.slice(0, midpoint);
    const secondHalf = scores.slice(midpoint);

    const firstAvg =
      firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;

    const difference = secondAvg - firstAvg;

    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  /**
   * Get performance analytics for a learning path
   */
  async getAnalytics(
    userId: string,
    learningPathId: string,
  ): Promise<{
    totalSteps: number;
    completedSteps: number;
    averageScore: number;
    totalTimeSpent: number; // minutes
    completionRate: number;
    skillBreakdown: Array<{
      skill: string;
      averageScore: number;
      completedCount: number;
    }>;
  }> {
    try {
      const steps = await this.prisma.learningPathStep.findMany({
        where: {
          learningPathId,
        },
        include: {
          variant: true,
          activity: true,
        },
      });

      const completedSteps = steps.filter((s) => s.completedAt !== null);
      const totalScore = completedSteps.reduce(
        (sum, step) => sum + (step.score || 0),
        0,
      );
      const totalTimeSpent = completedSteps.reduce(
        (sum, step) => sum + (step.timeSpent || 0),
        0,
      );

      // Group by skill
      const skillMap = new Map<string, { totalScore: number; count: number }>();

      for (const step of completedSteps) {
        const skill = step.variant?.skill || 'unknown';

        if (!skillMap.has(skill)) {
          skillMap.set(skill, { totalScore: 0, count: 0 });
        }

        const current = skillMap.get(skill)!;
        current.totalScore += step.score || 0;
        current.count += 1;
      }

      const skillBreakdown = Array.from(skillMap.entries()).map(
        ([skill, data]) => ({
          skill,
          averageScore: Math.round(data.totalScore / data.count),
          completedCount: data.count,
        }),
      );

      return {
        totalSteps: steps.length,
        completedSteps: completedSteps.length,
        averageScore:
          completedSteps.length > 0
            ? Math.round(totalScore / completedSteps.length)
            : 0,
        totalTimeSpent: Math.round(totalTimeSpent / 60), // Convert to minutes
        completionRate: steps.length > 0 ? completedSteps.length / steps.length : 0,
        skillBreakdown,
      };
    } catch (error) {
      this.logger.error(`Failed to get analytics: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Detect struggling patterns (for intervention)
   */
  async detectStrugglingPatterns(
    userId: string,
    learningPathId: string,
  ): Promise<{
    isStruggling: boolean;
    patterns: string[];
    recommendations: string[];
  }> {
    const recent = await this.getRecentOverallPerformance(
      userId,
      learningPathId,
      10,
    );

    const patterns: string[] = [];
    const recommendations: string[] = [];
    let isStruggling = false;

    // Pattern 1: Low success rate
    if (recent.successRate < 0.5) {
      isStruggling = true;
      patterns.push('Low success rate (< 50%)');
      recommendations.push('Reduce difficulty level');
    }

    // Pattern 2: Declining trend
    if (recent.trend === 'declining') {
      isStruggling = true;
      patterns.push('Performance declining over time');
      recommendations.push('Review foundational concepts');
    }

    // Pattern 3: Very low average score
    if (recent.averageScore < 40) {
      isStruggling = true;
      patterns.push('Very low average score (< 40%)');
      recommendations.push('Provide remedial activities');
    }

    // Pattern 4: Consistent failures
    const recentFailures = recent.recentActivities.filter((a) => !a.success);
    if (recentFailures.length >= 5) {
      isStruggling = true;
      patterns.push('Consecutive failures detected');
      recommendations.push('Insert easier practice activities');
    }

    return {
      isStruggling,
      patterns,
      recommendations,
    };
  }
}
