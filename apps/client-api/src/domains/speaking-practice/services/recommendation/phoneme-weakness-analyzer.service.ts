import { Injectable } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { PhonemeWeakness } from './types';
import { recommendationConfig } from '../../config/recommendation.config';

@Injectable()
export class PhonemeWeaknessAnalyzerService {
  constructor(private prisma: PrismaService) {}

  async getUserWeakPhonemes(userId: string): Promise<PhonemeWeakness[]> {
    // Get all mispronounced words for the user
    const mispronounceWords = await this.prisma.mispronounceWord.findMany({
      where: {
        userId,
        problematicPhoneme: {
          not: null,
        },
      },
      select: {
        problematicPhoneme: true,
        errorCount: true,
        correctCount: true,
      },
    });

    // Aggregate by phoneme
    const phonemeMap = new Map<string, { errorCount: number; correctCount: number }>();

    mispronounceWords.forEach((word) => {
      const phoneme = word.problematicPhoneme!;
      const existing = phonemeMap.get(phoneme) || { errorCount: 0, correctCount: 0 };

      phonemeMap.set(phoneme, {
        errorCount: existing.errorCount + word.errorCount,
        correctCount: existing.correctCount + word.correctCount,
      });
    });

    // Calculate error rates
    const weaknessData: PhonemeWeakness[] = Array.from(phonemeMap.entries()).map(
      ([phoneme, stats]) => {
        const totalAttempts = stats.errorCount + stats.correctCount;
        const errorRate = totalAttempts > 0 ? stats.errorCount / totalAttempts : 0;

        return {
          phoneme,
          errorCount: stats.errorCount,
          correctCount: stats.correctCount,
          errorRate,
        };
      },
    );

    // Filter by minimum error rate and sort by error rate (descending)
    const filteredWeaknesses = weaknessData
      .filter((w) => w.errorRate >= recommendationConfig.minErrorRateForWeakness)
      .sort((a, b) => b.errorRate - a.errorRate);

    // Return top N weak phonemes
    return filteredWeaknesses.slice(0, recommendationConfig.topWeakPhonemesCount);
  }
}
