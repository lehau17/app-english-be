import { Injectable } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { TopicSuccessRate } from './types';

@Injectable()
export class SuccessRateCalculatorService {
  constructor(private prisma: PrismaService) {}

  async getTopicSuccessRates(userId: string): Promise<TopicSuccessRate[]> {
    // Get all topic progress for the user
    const topicProgress = await this.prisma.topicProgress.findMany({
      where: {
        userId,
      },
      select: {
        category: true,
        avgScore: true,
        totalAttempts: true,
      },
    });

    // Calculate success rate inverse factor for each topic
    const successRateData: TopicSuccessRate[] = topicProgress.map((progress) => {
      const avgScore = progress.avgScore || 0;

      // Calculate inverse factor (lower score → higher recommendation priority)
      // Formula: inverseFactor = 1 - (avgScore / 100)
      // If avgScore = 30, inverseFactor = 0.7 (high priority)
      // If avgScore = 90, inverseFactor = 0.1 (low priority)
      const successRateInverseFactor = 1 - avgScore / 100;

      return {
        category: progress.category,
        avgScore,
        totalAttempts: progress.totalAttempts,
        successRateInverseFactor: Math.max(0, Math.min(1, successRateInverseFactor)),
      };
    });

    return successRateData;
  }

  async getTopicSuccessRateByCategory(userId: string, category: string): Promise<TopicSuccessRate | null> {
    const allSuccessRates = await this.getTopicSuccessRates(userId);
    return allSuccessRates.find((sr) => sr.category === category) || null;
  }
}
