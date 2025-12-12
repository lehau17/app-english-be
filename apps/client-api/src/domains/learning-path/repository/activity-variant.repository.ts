import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { ActivityType, ActivityVariant, DifficultyLevel } from '@prisma/client';

/**
 * Repository for managing AI-generated activity variants
 */
@Injectable()
export class ActivityVariantRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Create a new activity variant
   */
  async create(data: {
    baseActivityId?: string;
    activityType: ActivityType;
    difficulty: DifficultyLevel;
    skill: string;
    title: string;
    description?: string;
    content: any;
    mediaUrls?: string[];
    promptTemplateId?: string;
    generationParams?: any;
    aiModel?: string;
  }): Promise<ActivityVariant> {
    return this.prisma.activityVariant.create({
      data: {
        ...data,
        mediaUrls: data.mediaUrls || [],
      },
    });
  }

  /**
   * Find variant by ID
   */
  async findById(id: string): Promise<ActivityVariant | null> {
    return this.prisma.activityVariant.findUnique({
      where: { id },
    });
  }

  /**
   * Find variants by type and difficulty
   */
  async findByTypeAndDifficulty(
    activityType: ActivityType,
    difficulty: DifficultyLevel,
    options?: {
      skill?: string;
      limit?: number;
      approved?: boolean;
    },
  ): Promise<ActivityVariant[]> {
    return this.prisma.activityVariant.findMany({
      where: {
        activityType,
        difficulty,
        ...(options?.skill && { skill: options.skill }),
        ...(options?.approved !== undefined && {
          isApproved: options.approved,
        }),
      },
      orderBy: [
        { usageCount: 'desc' }, // Prefer frequently used variants
        { averageScore: 'desc' }, // Then by quality
      ],
      take: options?.limit,
    });
  }

  /**
   * Find variants by skill
   */
  async findBySkill(
    skill: string,
    options?: {
      difficulty?: DifficultyLevel;
      limit?: number;
    },
  ): Promise<ActivityVariant[]> {
    return this.prisma.activityVariant.findMany({
      where: {
        skill,
        ...(options?.difficulty && { difficulty: options.difficulty }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit,
    });
  }

  /**
   * Find variants by prompt template
   */
  async findByPromptTemplate(
    promptTemplateId: string,
  ): Promise<ActivityVariant[]> {
    return this.prisma.activityVariant.findMany({
      where: { promptTemplateId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update variant usage stats
   */
  async updateUsageStats(
    id: string,
    data: {
      score?: number;
      incrementUsage?: boolean;
      incrementFeedback?: boolean;
    },
  ): Promise<ActivityVariant> {
    const variant = await this.findById(id);
    if (!variant) {
      throw new Error('Variant not found');
    }

    const updates: any = {};

    // Increment usage count
    if (data.incrementUsage) {
      updates.usageCount = variant.usageCount + 1;
    }

    // Increment feedback count
    if (data.incrementFeedback) {
      updates.feedbackCount = variant.feedbackCount + 1;
    }

    // Update average score
    if (data.score !== undefined) {
      const currentTotal = (variant.averageScore || 0) * variant.usageCount;
      const newTotal = currentTotal + data.score;
      const newUsageCount = variant.usageCount + 1;
      updates.averageScore = newTotal / newUsageCount;
      updates.usageCount = newUsageCount;
    }

    return this.prisma.activityVariant.update({
      where: { id },
      data: updates,
    });
  }

  /**
   * Approve variant
   */
  async approve(id: string): Promise<ActivityVariant> {
    return this.prisma.activityVariant.update({
      where: { id },
      data: { isApproved: true },
    });
  }

  /**
   * Get random variant for activity type and difficulty
   */
  async getRandomVariant(
    activityType: ActivityType,
    difficulty: DifficultyLevel,
    skill?: string,
  ): Promise<ActivityVariant | null> {
    const variants = await this.findByTypeAndDifficulty(
      activityType,
      difficulty,
      {
        skill,
        approved: true,
        limit: 10, // Get top 10, then pick random
      },
    );

    if (variants.length === 0) {
      return null;
    }

    // Weighted random selection (prefer higher usage variants)
    const totalWeight = variants.reduce((sum, v) => sum + v.usageCount + 1, 0);
    let random = Math.random() * totalWeight;

    for (const variant of variants) {
      random -= variant.usageCount + 1;
      if (random <= 0) {
        return variant;
      }
    }

    return variants[0]; // Fallback
  }

  /**
   * Get high-quality variants (approved + good scores)
   */
  async getHighQualityVariants(options: {
    activityType?: ActivityType;
    difficulty?: DifficultyLevel;
    skill?: string;
    minScore?: number;
    limit?: number;
  }): Promise<ActivityVariant[]> {
    return this.prisma.activityVariant.findMany({
      where: {
        isApproved: true,
        averageScore: {
          gte: options.minScore || 70,
        },
        ...(options.activityType && { activityType: options.activityType }),
        ...(options.difficulty && { difficulty: options.difficulty }),
        ...(options.skill && { skill: options.skill }),
      },
      orderBy: [
        { averageScore: 'desc' },
        { usageCount: 'desc' },
      ],
      take: options.limit || 10,
    });
  }

  /**
   * Delete variant
   */
  async delete(id: string): Promise<ActivityVariant> {
    return this.prisma.activityVariant.delete({
      where: { id },
    });
  }

  /**
   * Get statistics for variants
   */
  async getStatistics(): Promise<{
    total: number;
    approved: number;
    byType: Record<string, number>;
    byDifficulty: Record<string, number>;
    averageUsage: number;
  }> {
    const variants = await this.prisma.activityVariant.findMany({
      select: {
        activityType: true,
        difficulty: true,
        isApproved: true,
        usageCount: true,
      },
    });

    const byType: Record<string, number> = {};
    const byDifficulty: Record<string, number> = {};
    let totalUsage = 0;
    let approvedCount = 0;

    variants.forEach((v) => {
      byType[v.activityType] = (byType[v.activityType] || 0) + 1;
      byDifficulty[v.difficulty] = (byDifficulty[v.difficulty] || 0) + 1;
      totalUsage += v.usageCount;
      if (v.isApproved) approvedCount++;
    });

    return {
      total: variants.length,
      approved: approvedCount,
      byType,
      byDifficulty,
      averageUsage: variants.length > 0 ? totalUsage / variants.length : 0,
    };
  }
}
