import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@app/database';
import {
  SpeakingPracticeProgress,
  SpeakingPracticeAttempt,
  SpeakingPracticeLesson,
  PersonalizedDrill,
  MispronounceWord,
  Prisma,
} from '@prisma/client';

/**
 * Speaking Practice Repository
 * Progress-Based data access for AI Speaking Practice
 */
@Injectable()
export class SpeakingPracticeRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  // ============ Progress Methods ============

  /**
   * Find or create user's progress
   * Progress-Based: always 1 per user
   */
  async findOrCreateProgress(userId: string): Promise<SpeakingPracticeProgress> {
    return this.prisma.speakingPracticeProgress.upsert({
      where: { userId },
      update: {}, // Don't update anything on find
      create: {
        userId,
        currentLevel: 1,
        completedLessons: [],
        weakPhonemes: [],
        streakDays: 0,
        totalPracticeTimeMinutes: 0,
      },
    });
  }

  /**
   * Update user's progress
   */
  async updateProgress(
    userId: string,
    data: Prisma.SpeakingPracticeProgressUpdateInput,
  ): Promise<SpeakingPracticeProgress> {
    return this.prisma.speakingPracticeProgress.update({
      where: { userId },
      data: {
        ...data,
        lastPracticedAt: new Date(),
      },
    });
  }

  /**
   * Add completed lesson to progress
   */
  async addCompletedLesson(
    userId: string,
    lessonId: string,
  ): Promise<SpeakingPracticeProgress> {
    const progress = await this.findOrCreateProgress(userId);
    const completedLessons = [...(progress.completedLessons || []), lessonId];

    return this.prisma.speakingPracticeProgress.update({
      where: { userId },
      data: {
        completedLessons,
        currentLessonId: null, // Reset current lesson
        lastPracticedAt: new Date(),
      },
    });
  }

  /**
   * Update weak phonemes
   */
  async updateWeakPhonemes(
    userId: string,
    phonemes: string[],
  ): Promise<SpeakingPracticeProgress> {
    return this.prisma.speakingPracticeProgress.update({
      where: { userId },
      data: { weakPhonemes: phonemes },
    });
  }

  // ============ Attempt Methods ============

  /**
   * Create new practice attempt
   */
  async createAttempt(
    data: Prisma.SpeakingPracticeAttemptCreateInput,
  ): Promise<SpeakingPracticeAttempt> {
    return this.prisma.speakingPracticeAttempt.create({ data });
  }

  /**
   * Get user's recent attempts
   */
  async getRecentAttempts(
    userId: string,
    limit = 20,
  ): Promise<SpeakingPracticeAttempt[]> {
    return this.prisma.speakingPracticeAttempt.findMany({
      where: {
        progress: { userId },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Calculate success rate for user
   */
  async calculateSuccessRate(userId: string): Promise<number> {
    const attempts = await this.prisma.speakingPracticeAttempt.findMany({
      where: {
        progress: { userId },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      select: { verdict: true },
    });

    if (attempts.length === 0) return 0;

    const passed = attempts.filter((a) => a.verdict === 'pass').length;
    return Math.round((passed / attempts.length) * 100);
  }

  // ============ Lesson Methods ============

  /**
   * Find next lesson for user at level
   */
  async findNextLesson(
    userId: string,
    level: number,
  ): Promise<SpeakingPracticeLesson | null> {
    const progress = await this.findOrCreateProgress(userId);
    const completedIds = progress.completedLessons || [];

    return this.prisma.speakingPracticeLesson.findFirst({
      where: {
        level,
        isActive: true,
        isTemplate: true,
        id: { notIn: completedIds },
      },
      orderBy: { orderIndex: 'asc' },
    });
  }

  /**
   * Find lesson by ID
   */
  async findLessonById(id: string): Promise<SpeakingPracticeLesson | null> {
    return this.prisma.speakingPracticeLesson.findUnique({
      where: { id },
    });
  }

  /**
   * Get all lessons at level
   */
  async getLessonsAtLevel(level: number): Promise<SpeakingPracticeLesson[]> {
    return this.prisma.speakingPracticeLesson.findMany({
      where: {
        level,
        isActive: true,
        isTemplate: true,
      },
      orderBy: { orderIndex: 'asc' },
    });
  }

  /**
   * Count lessons at level
   */
  async countLessonsAtLevel(level: number): Promise<number> {
    return this.prisma.speakingPracticeLesson.count({
      where: {
        level,
        isActive: true,
        isTemplate: true,
      },
    });
  }

  // ============ Drill Methods ============

  /**
   * Get personalized drills for user
   */
  async getPersonalizedDrills(
    userId: string,
    options: { status?: string; limit?: number } = {},
  ): Promise<PersonalizedDrill[]> {
    const where: Prisma.PersonalizedDrillWhereInput = { userId };
    if (options.status) {
      where.status = options.status;
    }

    return this.prisma.personalizedDrill.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: options.limit || 5,
    });
  }

  /**
   * Update drill status
   */
  async updateDrillStatus(
    drillId: string,
    status: string,
  ): Promise<PersonalizedDrill> {
    return this.prisma.personalizedDrill.update({
      where: { id: drillId },
      data: { status },
    });
  }

  // ============ Mispronounce Word Methods ============

  /**
   * Record mispronounced word
   */
  async recordMispronounceWord(
    userId: string,
    word: string,
    data: {
      phoneme?: string;
      contextSentence?: string;
      source: 'free_chat' | 'practice_mode';
    },
  ): Promise<MispronounceWord> {
    return this.prisma.mispronounceWord.upsert({
      where: {
        userId_word: { userId, word: word.toLowerCase() },
      },
      update: {
        errorCount: { increment: 1 },
        lastOccurredAt: new Date(),
        contextSentence: data.contextSentence,
      },
      create: {
        userId,
        word: word.toLowerCase(),
        errorCount: 1,
        problematicPhoneme: data.phoneme,
        contextSentence: data.contextSentence,
        source: data.source,
        lastOccurredAt: new Date(),
      },
    });
  }

  /**
   * Get user's frequently mispronounced words
   */
  async getFrequentMispronounceWords(
    userId: string,
    limit = 10,
  ): Promise<MispronounceWord[]> {
    return this.prisma.mispronounceWord.findMany({
      where: { userId },
      orderBy: { errorCount: 'desc' },
      take: limit,
    });
  }

  /**
   * Get total mispronounced word count for user
   */
  async getTotalMispronounceCount(userId: string): Promise<number> {
    const result = await this.prisma.mispronounceWord.aggregate({
      where: { userId },
      _sum: { errorCount: true },
    });
    return result._sum.errorCount || 0;
  }

  // ============ SM-2 Due Words Methods ============

  /**
   * Get words due for review (SM-2 spaced repetition)
   * Returns words where nextReviewDate <= now
   */
  async getDueWordsForReview(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<MispronounceWord[]> {
    const { limit = 20, offset = 0 } = options;
    const now = new Date();

    return this.prisma.mispronounceWord.findMany({
      where: {
        userId,
        nextReviewDate: { lte: now },
      },
      orderBy: [
        { nextReviewDate: 'asc' }, // Most overdue first
        { errorCount: 'desc' }, // Then by error count
      ],
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get count of words due for review
   */
  async getDueWordsCount(userId: string): Promise<number> {
    const now = new Date();

    return this.prisma.mispronounceWord.count({
      where: {
        userId,
        nextReviewDate: { lte: now },
      },
    });
  }

  /**
   * Update word after successful review (SM-2 update)
   * Called when user correctly pronounces a previously mispronounced word
   */
  async updateWordReview(
    userId: string,
    word: string,
    srsData: {
      easeFactor: number;
      interval: number;
      repetitions: number;
      nextReviewDate: Date;
      lastReviewedAt: Date;
    },
  ): Promise<MispronounceWord> {
    return this.prisma.mispronounceWord.update({
      where: { userId_word: { userId, word: word.toLowerCase() } },
      data: {
        easeFactor: srsData.easeFactor,
        interval: srsData.interval,
        repetitions: srsData.repetitions,
        nextReviewDate: srsData.nextReviewDate,
        lastReviewedAt: srsData.lastReviewedAt,
      },
    });
  }

  /**
   * Get SM-2 statistics for user
   */
  async getSRSStats(userId: string): Promise<{
    totalWords: number;
    dueToday: number;
    masteredCount: number;
    learningCount: number;
    averageEaseFactor: number;
  }> {
    const now = new Date();

    const [totalWords, dueToday, mastered, avgEase] = await Promise.all([
      this.prisma.mispronounceWord.count({ where: { userId } }),
      this.prisma.mispronounceWord.count({
        where: { userId, nextReviewDate: { lte: now } },
      }),
      this.prisma.mispronounceWord.count({
        where: { userId, repetitions: { gte: 5 }, interval: { gte: 21 } },
      }),
      this.prisma.mispronounceWord.aggregate({
        where: { userId },
        _avg: { easeFactor: true },
      }),
    ]);

    const learningCount = totalWords - mastered;

    return {
      totalWords,
      dueToday,
      masteredCount: mastered,
      learningCount,
      averageEaseFactor: Number((avgEase._avg.easeFactor || 2.5).toFixed(2)),
    };
  }
}
