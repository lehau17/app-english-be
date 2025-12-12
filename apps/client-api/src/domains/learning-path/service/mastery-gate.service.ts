import { Injectable, Logger } from '@nestjs/common';
import { SkillProgressRepository } from '../repository';

/**
 * Mastery Gate Service
 * Implements mastery threshold checking (85%) to block advancement
 * until prerequisite skills are sufficiently mastered
 */
@Injectable()
export class MasteryGateService {
  private readonly logger = new Logger(MasteryGateService.name);

  // Default mastery threshold (85%)
  private readonly DEFAULT_THRESHOLD = 0.85;

  constructor(
    private readonly skillProgressRepo: SkillProgressRepository,
  ) {}

  /**
   * Check if user can advance based on mastery thresholds
   * @param userId - User ID
   * @param requiredSkills - Array of skills that must be mastered
   * @param threshold - Mastery threshold (0-1), defaults to 0.85 (85%)
   */
  async checkMastery(
    userId: string,
    requiredSkills: string[],
    threshold: number = this.DEFAULT_THRESHOLD,
  ): Promise<{
    canAdvance: boolean;
    skillsBlocking: string[];
    skillsProgress: Array<{
      skill: string;
      masteryScore: number;
      required: number;
      gap: number;
    }>;
  }> {
    if (requiredSkills.length === 0) {
      return {
        canAdvance: true,
        skillsBlocking: [],
        skillsProgress: [],
      };
    }

    const skillsBlocking: string[] = [];
    const skillsProgress: Array<{
      skill: string;
      masteryScore: number;
      required: number;
      gap: number;
    }> = [];

    // Convert threshold to 0-100 scale
    const requiredScore = threshold * 100;

    // Check each required skill
    for (const skill of requiredSkills) {
      const progress = await this.skillProgressRepo.findByUserIdAndSkill(
        userId,
        skill,
      );

      const masteryScore = progress?.masteryScore || 0;
      const gap = requiredScore - masteryScore;

      skillsProgress.push({
        skill,
        masteryScore,
        required: requiredScore,
        gap: Math.max(0, gap),
      });

      // Check if skill is below threshold
      if (masteryScore < requiredScore) {
        skillsBlocking.push(skill);
      }
    }

    const canAdvance = skillsBlocking.length === 0;

    this.logger.debug(
      `Mastery check for user ${userId}: ${canAdvance ? 'PASS' : 'FAIL'} (${skillsBlocking.length} skills blocking)`,
    );

    return {
      canAdvance,
      skillsBlocking,
      skillsProgress,
    };
  }

  /**
   * Get weakest skills that need remediation
   * @param userId - User ID
   * @param skills - Skills to check
   * @param threshold - Minimum acceptable mastery
   */
  async getWeakSkills(
    userId: string,
    skills: string[],
    threshold: number = this.DEFAULT_THRESHOLD,
  ): Promise<
    Array<{
      skill: string;
      masteryScore: number;
      gap: number;
    }>
  > {
    const weakSkills: Array<{
      skill: string;
      masteryScore: number;
      gap: number;
    }> = [];

    const requiredScore = threshold * 100;

    for (const skill of skills) {
      const progress = await this.skillProgressRepo.findByUserIdAndSkill(
        userId,
        skill,
      );

      const masteryScore = progress?.masteryScore || 0;

      if (masteryScore < requiredScore) {
        weakSkills.push({
          skill,
          masteryScore,
          gap: requiredScore - masteryScore,
        });
      }
    }

    // Sort by gap (largest gap first - most urgent)
    return weakSkills.sort((a, b) => b.gap - a.gap);
  }

  /**
   * Calculate remediation priority for weak skills
   * Returns skills sorted by urgency (considering gap, previous attempts, etc.)
   */
  async getRemediationPriority(
    userId: string,
    skills: string[],
  ): Promise<
    Array<{
      skill: string;
      masteryScore: number;
      totalAttempts: number;
      lastReviewAt: Date | null;
      urgency: number;
    }>
  > {
    const priorities: Array<{
      skill: string;
      masteryScore: number;
      totalAttempts: number;
      lastReviewAt: Date | null;
      urgency: number;
    }> = [];

    for (const skill of skills) {
      const progress = await this.skillProgressRepo.findByUserIdAndSkill(
        userId,
        skill,
      );

      if (!progress) {
        // New skill - high priority
        priorities.push({
          skill,
          masteryScore: 0,
          totalAttempts: 0,
          lastReviewAt: null,
          urgency: 100,
        });
        continue;
      }

      // Calculate urgency score (0-100)
      const urgency = this.calculateUrgency(
        progress.masteryScore,
        progress.totalAttempts,
        progress.lastReviewAt,
      );

      priorities.push({
        skill,
        masteryScore: progress.masteryScore,
        totalAttempts: progress.totalAttempts,
        lastReviewAt: progress.lastReviewAt,
        urgency,
      });
    }

    // Sort by urgency (highest first)
    return priorities.sort((a, b) => b.urgency - a.urgency);
  }

  /**
   * Calculate urgency score for remediation
   * Higher score = more urgent
   */
  private calculateUrgency(
    masteryScore: number,
    totalAttempts: number,
    lastReviewAt: Date | null,
  ): number {
    // Factor 1: Low mastery score = high urgency (inverse relationship)
    const masteryUrgency = (100 - masteryScore) * 0.5;

    // Factor 2: Few attempts = higher urgency (need more practice)
    const attemptUrgency = Math.max(0, (20 - totalAttempts) * 2);

    // Factor 3: Time since last review
    let timeUrgency = 0;
    if (lastReviewAt) {
      const daysSinceReview = Math.floor(
        (Date.now() - lastReviewAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      timeUrgency = Math.min(daysSinceReview * 2, 30); // Cap at 30
    } else {
      timeUrgency = 30; // Never reviewed - high urgency
    }

    // Weighted sum
    const urgency = masteryUrgency * 0.5 + attemptUrgency * 0.3 + timeUrgency * 0.2;

    return Math.min(Math.round(urgency), 100);
  }

  /**
   * Check if user meets prerequisite requirements for a learning path step
   */
  async checkPrerequisites(
    userId: string,
    prerequisites: Array<{ skill: string; minimumMastery: number }>,
  ): Promise<{
    met: boolean;
    missing: Array<{ skill: string; current: number; required: number }>;
  }> {
    const missing: Array<{ skill: string; current: number; required: number }> = [];

    for (const prereq of prerequisites) {
      const progress = await this.skillProgressRepo.findByUserIdAndSkill(
        userId,
        prereq.skill,
      );

      const currentMastery = progress?.masteryScore || 0;

      if (currentMastery < prereq.minimumMastery) {
        missing.push({
          skill: prereq.skill,
          current: currentMastery,
          required: prereq.minimumMastery,
        });
      }
    }

    return {
      met: missing.length === 0,
      missing,
    };
  }

  /**
   * Get overall mastery status for a user across all tracked skills
   */
  async getOverallMasteryStatus(userId: string): Promise<{
    averageMastery: number;
    totalSkills: number;
    masteredSkills: number;
    weakSkills: number;
    atRiskSkills: number;
  }> {
    const overall = await this.skillProgressRepo.calculateOverallProgress(userId);

    // Count at-risk skills (< 60% mastery)
    const allProgress = await this.skillProgressRepo.findByUserId(userId);
    const atRiskSkills = allProgress.filter((s) => s.masteryScore < 60).length;

    return {
      ...overall,
      atRiskSkills,
    };
  }
}
