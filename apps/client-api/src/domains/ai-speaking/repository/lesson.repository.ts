import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { DifficultyLevel, SpeakingPracticeLesson } from '@prisma/client';

@Injectable()
export class LessonRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Find next lesson for user (excludes completed lessons)
   * Supports MULTIPLE lessons per level (≥10 per level)
   */
  async findNextLessonForUser(
    userId: string,
    level: number,
    difficulty: DifficultyLevel
  ): Promise<SpeakingPracticeLesson | null> {
    // Get user's progress record
    const progress = await this.prisma.speakingPracticeProgress.findUnique({
      where: { userId },
      select: { completedLessons: true }
    });

    const completedIds = progress?.completedLessons || [];

    // Find lesson NOT completed by user
    return this.prisma.speakingPracticeLesson.findFirst({
      where: {
        level,
        difficulty,
        isTemplate: true,
        isActive: true,
        id: { notIn: completedIds }
      },
      orderBy: { orderIndex: 'asc' } // Order by sequence
    });
  }

  /**
   * Find all lessons at a level (for lesson list UI)
   */
  async findAllLessonsAtLevel(
    level: number,
    difficulty: DifficultyLevel
  ): Promise<SpeakingPracticeLesson[]> {
    return this.prisma.speakingPracticeLesson.findMany({
      where: {
        level,
        difficulty,
        isTemplate: true,
        isActive: true
      },
      orderBy: { orderIndex: 'asc' }
    });
  }

  /**
   * Find remedial drills for weak phonemes
   */
  async findRemedialDrills(
    phonemes: string[],
    level: number
  ): Promise<SpeakingPracticeLesson[]> {
    return this.prisma.speakingPracticeLesson.findMany({
      where: {
        targetPhonemes: { hasSome: phonemes },
        level: { lte: level },
        isActive: true
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Create a new lesson template
   */
  async create(data: any): Promise<SpeakingPracticeLesson> {
    return this.prisma.speakingPracticeLesson.create({ data });
  }

  /**
   * Find lesson by ID
   */
  async findById(id: string): Promise<SpeakingPracticeLesson | null> {
    return this.prisma.speakingPracticeLesson.findUnique({
      where: { id }
    });
  }

  /**
   * Update lesson template
   */
  async update(id: string, data: any): Promise<SpeakingPracticeLesson> {
    return this.prisma.speakingPracticeLesson.update({
      where: { id },
      data
    });
  }

  /**
   * Delete lesson template
   */
  async delete(id: string): Promise<SpeakingPracticeLesson> {
    return this.prisma.speakingPracticeLesson.delete({
      where: { id }
    });
  }
}
