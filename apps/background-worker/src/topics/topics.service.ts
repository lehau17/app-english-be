import { Injectable, Logger } from '@nestjs/common';
import { PrismaRepository } from '@app/database';

@Injectable()
export class TopicsService {
  private readonly logger = new Logger(TopicsService.name);

  constructor(private readonly prisma: PrismaRepository) {}

  async calculateTrending(): Promise<void> {
    this.logger.log('Calculating trending scores for all active topics');

    const topics = await this.prisma.topic.findMany({
      where: { isActive: true },
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const topic of topics) {
      try {
        // Count usages in the last 7 days
        const recentUsage = await this.prisma.topicUsage.count({
          where: {
            topicId: topic.id,
            createdAt: { gte: weekAgo },
          },
        });

        // Calculate 4-week baseline
        const baselineUsage = topic.usageCount / 4;

        // Calculate trend score
        const trendScore =
          baselineUsage > 0
            ? (recentUsage / baselineUsage) * 100
            : recentUsage * 10; // For new topics, give higher initial score

        // Update topic with new trend score
        await this.prisma.topic.update({
          where: { id: topic.id },
          data: { trendScore },
        });

        this.logger.debug(
          `Topic "${topic.name}": recent=${recentUsage}, baseline=${baselineUsage.toFixed(2)}, score=${trendScore.toFixed(2)}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to calculate trending for topic ${topic.id}: ${error.message}`,
          error.stack,
        );
      }
    }

    this.logger.log(
      `Trending calculation completed for ${topics.length} topics`,
    );
  }
}
