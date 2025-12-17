import { Injectable } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { TopicFreshness } from './types';
import { recommendationConfig } from '../../config/recommendation.config';

@Injectable()
export class TopicFreshnessTrackerService {
  constructor(private prisma: PrismaService) {}

  async getTopicFreshness(userId: string): Promise<TopicFreshness[]> {
    // Get all topic progress for the user
    const topicProgress = await this.prisma.topicProgress.findMany({
      where: {
        userId,
      },
      select: {
        category: true,
        lastPracticedAt: true,
      },
    });

    const now = new Date();

    // Calculate freshness for each topic
    const freshnessData: TopicFreshness[] = topicProgress.map((progress) => {
      const lastPracticedAt = progress.lastPracticedAt;
      let daysSinceLastPractice = 0;
      let freshnessScore = 0;

      if (lastPracticedAt) {
        const diffMs = now.getTime() - lastPracticedAt.getTime();
        daysSinceLastPractice = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Calculate freshness score (0-1)
        // Higher score = more urgent to review
        // Cap at freshnessMaxDays for scoring
        const cappedDays = Math.min(
          daysSinceLastPractice,
          recommendationConfig.freshnessMaxDays,
        );
        freshnessScore = cappedDays / recommendationConfig.freshnessMaxDays;
      } else {
        // Never practiced = highest priority
        freshnessScore = 1.0;
        daysSinceLastPractice = Infinity;
      }

      return {
        category: progress.category,
        lastPracticedAt,
        daysSinceLastPractice,
        freshnessScore,
      };
    });

    return freshnessData;
  }

  async getTopicFreshnessByCategory(
    userId: string,
    category: string,
  ): Promise<TopicFreshness | null> {
    const allFreshness = await this.getTopicFreshness(userId);
    return allFreshness.find((f) => f.category === category) || null;
  }
}
