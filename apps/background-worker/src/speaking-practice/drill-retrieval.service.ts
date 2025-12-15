import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { PersonalizedDrill } from '@prisma/client';

export interface DrillItemDto {
  drillId: string;
  word: string;
  analysis: string;
  targetPhonemes: string[];
  practiceSentence?: string;
}

@Injectable()
export class DrillRetrievalService {
  private readonly logger = new Logger(DrillRetrievalService.name);

  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Get pending drills for user
   */
  async getPendingDrills(userId: string): Promise<PersonalizedDrill[]> {
    return this.prisma.personalizedDrill.findMany({
      where: {
        userId,
        status: { in: ['pending', 'in_progress'] },
      },
      orderBy: { priority: 'asc' },
    });
  }

  /**
   * Get next item in drill (word that hasn't been completed)
   */
  async getNextDrillItem(drillId: string): Promise<DrillItemDto | null> {
    const drill = await this.prisma.personalizedDrill.findUnique({
      where: { id: drillId },
    });

    if (!drill) return null;

    // Find next word that hasn't been completed
    const nextWord = drill.targetWords.find(
      (w) => !drill.wordsCompleted.includes(w),
    );

    if (!nextWord) {
      // All words completed, mark drill as completed
      await this.prisma.personalizedDrill.update({
        where: { id: drillId },
        data: { status: 'completed', completedAt: new Date() },
      });
      this.logger.log(`Drill ${drillId} completed`);
      return null;
    }

    // Find practice sentence containing this word
    const practiceSentence = drill.targetSentences.find((s) =>
      s.toLowerCase().includes(nextWord.toLowerCase()),
    );

    return {
      drillId,
      word: nextWord,
      analysis: drill.analysis,
      targetPhonemes: drill.targetPhonemes,
      practiceSentence,
    };
  }

  /**
   * Mark word as completed in drill
   */
  async markWordCompleted(drillId: string, word: string): Promise<void> {
    await this.prisma.personalizedDrill.update({
      where: { id: drillId },
      data: {
        wordsCompleted: { push: word },
        status: 'in_progress',
      },
    });
    this.logger.log(`Word "${word}" completed in drill ${drillId}`);
  }

  /**
   * Skip drill
   */
  async skipDrill(drillId: string): Promise<void> {
    await this.prisma.personalizedDrill.update({
      where: { id: drillId },
      data: { status: 'skipped' },
    });
    this.logger.log(`Drill ${drillId} skipped`);
  }

  /**
   * Get drill statistics for user
   */
  async getDrillStats(userId: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
  }> {
    const [total, completed, pending, inProgress] = await Promise.all([
      this.prisma.personalizedDrill.count({ where: { userId } }),
      this.prisma.personalizedDrill.count({
        where: { userId, status: 'completed' },
      }),
      this.prisma.personalizedDrill.count({
        where: { userId, status: 'pending' },
      }),
      this.prisma.personalizedDrill.count({
        where: { userId, status: 'in_progress' },
      }),
    ]);

    return { total, completed, pending, inProgress };
  }
}
