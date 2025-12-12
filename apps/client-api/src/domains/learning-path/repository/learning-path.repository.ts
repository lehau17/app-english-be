import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@app/database';
import { LearningPath, DifficultyLevel } from '@prisma/client';
import { CreateLearningPathDto, UpdateLearningPathDto } from '../dto';

@Injectable()
export class LearningPathRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async create(userId: string, dto: CreateLearningPathDto): Promise<LearningPath> {
    return this.prisma.learningPath.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  async findById(id: string): Promise<LearningPath | null> {
    return this.prisma.learningPath.findUnique({
      where: { id },
    });
  }

  async findByUserId(
    userId: string,
    filters?: {
      isCompleted?: boolean;
      targetLevel?: DifficultyLevel;
    },
  ): Promise<LearningPath[]> {
    return this.prisma.learningPath.findMany({
      where: {
        userId,
        ...(filters?.isCompleted !== undefined && { isCompleted: filters.isCompleted }),
        ...(filters?.targetLevel && { targetLevel: filters.targetLevel }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveByUserId(userId: string): Promise<LearningPath | null> {
    return this.prisma.learningPath.findFirst({
      where: {
        userId,
        isCompleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateLearningPathDto): Promise<LearningPath> {
    return this.prisma.learningPath.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string): Promise<LearningPath> {
    return this.prisma.learningPath.delete({
      where: { id },
    });
  }

  async advanceStep(id: string): Promise<LearningPath> {
    const path = await this.findById(id);
    if (!path) throw new Error('Learning path not found');

    const newStep = path.currentStep + 1;
    const isCompleted = newStep >= path.courseIds.length;

    return this.prisma.learningPath.update({
      where: { id },
      data: {
        currentStep: newStep,
        isCompleted,
        ...(isCompleted && { completedAt: new Date() }),
      },
    });
  }

  async getProgress(id: string, userId: string) {
    const path = await this.findById(id);
    if (!path || path.userId !== userId) {
      throw new Error('Learning path not found');
    }

    const totalSteps = path.courseIds.length;
    const completedSteps = path.currentStep;
    const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
      totalSteps,
      completedSteps,
      percentage,
      currentStep: path.currentStep,
      isCompleted: path.isCompleted,
    };
  }
}



