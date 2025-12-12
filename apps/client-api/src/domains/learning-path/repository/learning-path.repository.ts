import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import {
  DifficultyLevel,
  LearningPath,
  LearningPathStep,
  StepStatus,
} from '@prisma/client';
import {
  CreateLearningPathDto,
  UpdateLearningPathDto,
  CreateLearningPathWithStepsDto,
  CreateStepDto,
  UpdateStepDto,
} from '../dto';

@Injectable()
export class LearningPathRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async create(
    userId: string,
    dto: CreateLearningPathDto,
  ): Promise<LearningPath> {
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
        ...(filters?.isCompleted !== undefined && {
          isCompleted: filters.isCompleted,
        }),
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
    const isCompleted = newStep >= path.activityIds.length;

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

    const totalSteps = path.activityIds.length;
    const completedSteps = path.currentStep;
    const percentage =
      totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
      totalSteps,
      completedSteps,
      percentage,
      currentStep: path.currentStep,
      isCompleted: path.isCompleted,
    };
  }

  // ===================== NEW METHODS FOR DYNAMIC LEARNING PATHS =====================

  /**
   * Create learning path with steps in a single transaction
   */
  async createWithSteps(
    userId: string,
    dto: CreateLearningPathWithStepsDto,
  ): Promise<LearningPath & { steps: LearningPathStep[] }> {
    return this.prisma.learningPath.create({
      data: {
        userId,
        name: dto.name,
        targetLevel: dto.targetLevel,
        focusAreas: dto.focusAreas,
        timeframe: dto.timeframe,
        isDynamic: dto.isDynamic ?? true,
        classroomId: dto.classroomId,
        customContent: dto.customContent,
        activityIds: [], // Empty for dynamic paths
        steps: {
          create: dto.steps || [],
        },
      },
      include: {
        steps: {
          orderBy: { orderNo: 'asc' },
        },
      },
    });
  }

  /**
   * Find learning path with steps included
   */
  async findByIdWithSteps(
    id: string,
  ): Promise<(LearningPath & { steps: LearningPathStep[] }) | null> {
    return this.prisma.learningPath.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { orderNo: 'asc' },
        },
      },
    });
  }

  /**
   * Find active learning path by user ID with steps
   */
  async findActiveByUserIdWithSteps(
    userId: string,
  ): Promise<(LearningPath & { steps: LearningPathStep[] }) | null> {
    return this.prisma.learningPath.findFirst({
      where: {
        userId,
        isCompleted: false,
      },
      include: {
        steps: {
          orderBy: { orderNo: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Add a new step to learning path
   */
  async addStep(
    learningPathId: string,
    dto: CreateStepDto,
  ): Promise<LearningPathStep> {
    return this.prisma.learningPathStep.create({
      data: {
        learningPathId,
        ...dto,
      },
    });
  }

  /**
   * Update step status and metadata
   */
  async updateStepStatus(
    stepId: string,
    dto: UpdateStepDto,
  ): Promise<LearningPathStep> {
    return this.prisma.learningPathStep.update({
      where: { id: stepId },
      data: dto,
    });
  }

  /**
   * Get next pending step in learning path
   */
  async getNextPendingStep(
    learningPathId: string,
  ): Promise<LearningPathStep | null> {
    return this.prisma.learningPathStep.findFirst({
      where: {
        learningPathId,
        status: StepStatus.pending,
      },
      orderBy: { orderNo: 'asc' },
    });
  }

  /**
   * Get step by ID
   */
  async findStepById(stepId: string): Promise<LearningPathStep | null> {
    return this.prisma.learningPathStep.findUnique({
      where: { id: stepId },
    });
  }

  /**
   * Get all steps for a learning path
   */
  async findStepsByLearningPathId(
    learningPathId: string,
  ): Promise<LearningPathStep[]> {
    return this.prisma.learningPathStep.findMany({
      where: { learningPathId },
      orderBy: { orderNo: 'asc' },
    });
  }

  /**
   * Delete a step
   */
  async deleteStep(stepId: string): Promise<LearningPathStep> {
    return this.prisma.learningPathStep.delete({
      where: { id: stepId },
    });
  }

  /**
   * Count steps by status for a learning path
   */
  async countStepsByStatus(
    learningPathId: string,
    status: StepStatus,
  ): Promise<number> {
    return this.prisma.learningPathStep.count({
      where: {
        learningPathId,
        status,
      },
    });
  }

  /**
   * Find learning paths by user ID with dynamic filter
   */
  async findByUserIdDynamic(
    userId: string,
    isDynamic: boolean,
  ): Promise<LearningPath[]> {
    return this.prisma.learningPath.findMany({
      where: {
        userId,
        isDynamic,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
