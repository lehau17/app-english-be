import { Injectable } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { TopicReviewDue } from './types';

@Injectable()
export class SrsTopicReviewerService {
  constructor(private prisma: PrismaService) {}

  async getTopicReviews(userId: string): Promise<TopicReviewDue[]> {
    // Get all topic progress with SRS data
    const topicProgress = await this.prisma.topicProgress.findMany({
      where: {
        userId,
      },
      select: {
        category: true,
        nextReviewDate: true,
      },
    });

    const now = new Date();

    // Calculate SRS review scores
    const reviewData: TopicReviewDue[] = topicProgress.map((progress) => {
      const nextReviewDate = progress.nextReviewDate || now;
      const isDue = nextReviewDate <= now;

      return {
        category: progress.category,
        nextReviewDate,
        isDue,
        srsScore: isDue ? 1.0 : 0.0,
      };
    });

    return reviewData;
  }

  async getTopicReviewByCategory(userId: string, category: string): Promise<TopicReviewDue | null> {
    const allReviews = await this.getTopicReviews(userId);
    return allReviews.find((r) => r.category === category) || null;
  }

  /**
   * Update next review date after topic completion
   * Uses a simple interval-based approach:
   * - Low score (<50): review in 1 day
   * - Medium score (50-80): review in 3 days
   * - High score (>80): review in 7 days
   * @param userId User ID
   * @param category Topic category
   * @param score Score achieved (0-100)
   */
  async updateSrsAfterCompletion(userId: string, category: string, score: number): Promise<void> {
    // Determine interval based on score
    let intervalDays: number;
    if (score < 50) {
      intervalDays = 1; // Review soon if struggling
    } else if (score < 80) {
      intervalDays = 3; // Medium interval
    } else {
      intervalDays = 7; // Longer interval for high performance
    }

    // Calculate next review date
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

    // Update database
    await this.prisma.topicProgress.update({
      where: {
        userId_category: {
          userId,
          category,
        },
      },
      data: {
        nextReviewDate,
      },
    });
  }
}
