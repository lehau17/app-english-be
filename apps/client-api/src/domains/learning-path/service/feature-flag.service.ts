import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Service for managing feature flags
 * Specifically for ENABLE_DYNAMIC_LEARNING_PATHS flag
 */
@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private cache: Map<string, boolean> = new Map();
  private readonly CACHE_TTL_MS = 60000; // 1 minute cache

  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Check if dynamic learning paths feature is enabled for a user
   */
  async isDynamicLearningPathsEnabled(
    userId?: string,
    userRole?: UserRole,
  ): Promise<boolean> {
    const flagName = 'ENABLE_DYNAMIC_LEARNING_PATHS';

    try {
      const flag = await this.getFeatureFlag(flagName);

      if (!flag) {
        this.logger.warn(
          `Feature flag ${flagName} not found, defaulting to false`,
        );
        return false;
      }

      // If flag is globally disabled, return false
      if (!flag.isEnabled) {
        return false;
      }

      // Check if user is specifically included
      if (userId && flag.userIds.includes(userId)) {
        return true;
      }

      // Check if user's role is included
      if (userRole && flag.userRoles.includes(userRole)) {
        return true;
      }

      // Check percentage-based rollout (if no specific user/role targeting)
      if (flag.userIds.length === 0 && flag.userRoles.length === 0) {
        return this.checkPercentageRollout(userId, flag.percentage);
      }

      return false;
    } catch (error) {
      this.logger.error(`Error checking feature flag ${flagName}:`, error);
      return false; // Fail closed
    }
  }

  /**
   * Get feature flag from database (with caching)
   */
  private async getFeatureFlag(name: string) {
    const cached = this.cache.get(name);
    if (cached !== undefined) {
      return cached;
    }

    const flag = await this.prisma.featureFlag.findUnique({
      where: { name },
    });

    // Cache the result
    if (flag) {
      this.cache.set(name, flag as any);
      setTimeout(() => this.cache.delete(name), this.CACHE_TTL_MS);
    }

    return flag;
  }

  /**
   * Check if user falls within percentage rollout
   */
  private checkPercentageRollout(
    userId: string | undefined,
    percentage: number,
  ): boolean {
    if (percentage === 0) return false;
    if (percentage === 100) return true;
    if (!userId) return false;

    // Use hash of userId to deterministically assign users to rollout
    const hash = this.hashUserId(userId);
    return hash % 100 < percentage;
  }

  /**
   * Simple hash function for user ID
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Initialize feature flag (idempotent)
   */
  async initializeDynamicLearningPathsFlag(): Promise<void> {
    const flagName = 'ENABLE_DYNAMIC_LEARNING_PATHS';

    const existing = await this.prisma.featureFlag.findUnique({
      where: { name: flagName },
    });

    if (!existing) {
      await this.prisma.featureFlag.create({
        data: {
          name: flagName,
          description:
            'Enable AI-generated dynamic learning paths with adaptive difficulty and skill-based progression',
          isEnabled: false, // Start disabled
          percentage: 0, // Start at 0% rollout
          userRoles: [],
          userIds: [],
          variants: null,
        },
      });

      this.logger.log(`Feature flag ${flagName} initialized`);
    } else {
      this.logger.log(`Feature flag ${flagName} already exists`);
    }
  }

  /**
   * Update feature flag rollout percentage
   */
  async updateRolloutPercentage(
    name: string,
    percentage: number,
  ): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    await this.prisma.featureFlag.update({
      where: { name },
      data: { percentage },
    });

    this.cache.delete(name); // Invalidate cache
    this.logger.log(`Feature flag ${name} rollout updated to ${percentage}%`);
  }

  /**
   * Enable/disable feature flag globally
   */
  async setEnabled(name: string, isEnabled: boolean): Promise<void> {
    await this.prisma.featureFlag.update({
      where: { name },
      data: { isEnabled },
    });

    this.cache.delete(name); // Invalidate cache
    this.logger.log(
      `Feature flag ${name} ${isEnabled ? 'enabled' : 'disabled'}`,
    );
  }

  /**
   * Add users to feature flag targeting
   */
  async addUsers(name: string, userIds: string[]): Promise<void> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name },
    });

    if (!flag) {
      throw new Error(`Feature flag ${name} not found`);
    }

    const updatedUserIds = [...new Set([...flag.userIds, ...userIds])];

    await this.prisma.featureFlag.update({
      where: { name },
      data: { userIds: updatedUserIds },
    });

    this.cache.delete(name); // Invalidate cache
    this.logger.log(`Added ${userIds.length} users to feature flag ${name}`);
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('Feature flag cache cleared');
  }
}
