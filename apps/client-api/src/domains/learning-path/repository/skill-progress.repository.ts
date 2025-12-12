import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { SkillProgress } from '@prisma/client';

/**
 * Repository for managing skill progress and SRS tracking
 */
@Injectable()
export class SkillProgressRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Find or create skill progress for a user
   */
  async findOrCreate(
    userId: string,
    skill: string,
  ): Promise<SkillProgress> {
    const existing = await this.prisma.skillProgress.findUnique({
      where: {
        userId_skill: {
          userId,
          skill,
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Create with default SRS values
    return this.prisma.skillProgress.create({
      data: {
        userId,
        skill,
        nextReviewAt: new Date(), // Review immediately for new skills
      },
    });
  }

  /**
   * Update skill progress after practice
   */
  async updateProgress(
    userId: string,
    skill: string,
    data: {
      correctCount?: number;
      incorrectCount?: number;
      totalAttempts?: number;
      easeFactor?: number;
      interval?: number;
      repetitions?: number;
      level?: string;
      confidence?: number;
      masteryScore?: number;
      nextReviewAt?: Date;
    },
  ): Promise<SkillProgress> {
    return this.prisma.skillProgress.update({
      where: {
        userId_skill: {
          userId,
          skill,
        },
      },
      data: {
        ...data,
        lastReviewAt: new Date(),
      },
    });
  }

  /**
   * Get skill progress for a user
   */
  async findByUserId(userId: string): Promise<SkillProgress[]> {
    return this.prisma.skillProgress.findMany({
      where: { userId },
      orderBy: { masteryScore: 'desc' },
    });
  }

  /**
   * Get specific skill progress
   */
  async findByUserIdAndSkill(
    userId: string,
    skill: string,
  ): Promise<SkillProgress | null> {
    return this.prisma.skillProgress.findUnique({
      where: {
        userId_skill: {
          userId,
          skill,
        },
      },
    });
  }

  /**
   * Get skills due for review
   */
  async findDueForReview(
    userId: string,
    limit?: number,
  ): Promise<SkillProgress[]> {
    return this.prisma.skillProgress.findMany({
      where: {
        userId,
        nextReviewAt: {
          lte: new Date(),
        },
      },
      orderBy: {
        nextReviewAt: 'asc',
      },
      take: limit,
    });
  }

  /**
   * Get weakest skills (lowest mastery score)
   */
  async findWeakestSkills(
    userId: string,
    limit: number = 5,
  ): Promise<SkillProgress[]> {
    return this.prisma.skillProgress.findMany({
      where: {
        userId,
        masteryScore: {
          lt: 70, // Less than 70% mastery
        },
      },
      orderBy: {
        masteryScore: 'asc',
      },
      take: limit,
    });
  }

  /**
   * Get strongest skills (highest mastery score)
   */
  async findStrongestSkills(
    userId: string,
    limit: number = 5,
  ): Promise<SkillProgress[]> {
    return this.prisma.skillProgress.findMany({
      where: {
        userId,
      },
      orderBy: {
        masteryScore: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Calculate overall progress for a user
   */
  async calculateOverallProgress(userId: string): Promise<{
    averageMastery: number;
    totalSkills: number;
    masteredSkills: number;
    weakSkills: number;
  }> {
    const skills = await this.findByUserId(userId);

    if (skills.length === 0) {
      return {
        averageMastery: 0,
        totalSkills: 0,
        masteredSkills: 0,
        weakSkills: 0,
      };
    }

    const totalMastery = skills.reduce(
      (sum, skill) => sum + skill.masteryScore,
      0,
    );

    return {
      averageMastery: Math.round(totalMastery / skills.length),
      totalSkills: skills.length,
      masteredSkills: skills.filter((s) => s.masteryScore >= 80).length,
      weakSkills: skills.filter((s) => s.masteryScore < 50).length,
    };
  }

  /**
   * Delete skill progress
   */
  async delete(userId: string, skill: string): Promise<SkillProgress> {
    return this.prisma.skillProgress.delete({
      where: {
        userId_skill: {
          userId,
          skill,
        },
      },
    });
  }
}
