import { Test, TestingModule } from '@nestjs/testing';
import { PrismaRepository } from '@app/database';
import { LearningPathRepository } from './learning-path.repository';
import {
  DifficultyLevel,
  LearningPath,
  LearningPathStep,
  StepStatus,
} from '@prisma/client';

describe('LearningPathRepository', () => {
  let repository: LearningPathRepository;
  let prisma: jest.Mocked<PrismaRepository>;

  const mockUserId = 'user-123';
  const mockLearningPathId = 'path-123';

  const mockLearningPath: LearningPath = {
    id: mockLearningPathId,
    userId: mockUserId,
    classroomId: null,
    name: 'Test Path',
    targetLevel: DifficultyLevel.intermediate,
    focusAreas: ['vocabulary', 'grammar'],
    timeframe: 30,
    activityIds: [],
    customContent: null,
    isDynamic: true,
    currentStep: 0,
    isCompleted: false,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStep: LearningPathStep = {
    id: 'step-123',
    learningPathId: mockLearningPathId,
    activityId: null,
    variantId: 'variant-123',
    orderNo: 0,
    status: StepStatus.pending,
    difficulty: DifficultyLevel.beginner,
    title: 'Test Step',
    description: 'A test step',
    score: null,
    completedAt: null,
    timeSpent: null,
    attemptCount: 0,
    lastAttemptedAt: null,
    wasSkipped: false,
    skipReason: null,
    recommendedNext: [],
    adaptivityReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningPathRepository,
        {
          provide: PrismaRepository,
          useValue: {
            learningPath: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            learningPathStep: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<LearningPathRepository>(LearningPathRepository);
    prisma = module.get(PrismaRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('createWithSteps', () => {
    it('should create learning path with steps', async () => {
      const dto = {
        name: 'New Path',
        targetLevel: DifficultyLevel.intermediate,
        focusAreas: ['vocabulary'],
        steps: [
          {
            orderNo: 0,
            difficulty: DifficultyLevel.beginner,
            variantId: 'variant-1',
          },
        ],
      };

      const expected = {
        ...mockLearningPath,
        steps: [mockStep],
      };

      (prisma.learningPath.create as jest.Mock).mockResolvedValue(expected);

      const result = await repository.createWithSteps(mockUserId, dto);

      expect(result).toEqual(expected);
      expect(prisma.learningPath.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          name: dto.name,
          targetLevel: dto.targetLevel,
          focusAreas: dto.focusAreas,
          timeframe: undefined,
          isDynamic: true,
          classroomId: undefined,
          customContent: undefined,
          activityIds: [],
          steps: {
            create: dto.steps,
          },
        },
        include: {
          steps: {
            orderBy: { orderNo: 'asc' },
          },
        },
      });
    });
  });

  describe('findByIdWithSteps', () => {
    it('should find learning path with steps', async () => {
      const expected = {
        ...mockLearningPath,
        steps: [mockStep],
      };

      (prisma.learningPath.findUnique as jest.Mock).mockResolvedValue(expected);

      const result = await repository.findByIdWithSteps(mockLearningPathId);

      expect(result).toEqual(expected);
      expect(prisma.learningPath.findUnique).toHaveBeenCalledWith({
        where: { id: mockLearningPathId },
        include: {
          steps: {
            orderBy: { orderNo: 'asc' },
          },
        },
      });
    });

    it('should return null if not found', async () => {
      (prisma.learningPath.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByIdWithSteps('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findActiveByUserIdWithSteps', () => {
    it('should find active learning path with steps', async () => {
      const expected = {
        ...mockLearningPath,
        steps: [mockStep],
      };

      (prisma.learningPath.findFirst as jest.Mock).mockResolvedValue(expected);

      const result = await repository.findActiveByUserIdWithSteps(mockUserId);

      expect(result).toEqual(expected);
      expect(prisma.learningPath.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isCompleted: false,
        },
        include: {
          steps: {
            orderBy: { orderNo: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('addStep', () => {
    it('should add step to learning path', async () => {
      const dto = {
        orderNo: 1,
        difficulty: DifficultyLevel.intermediate,
        variantId: 'variant-new',
      };

      (prisma.learningPathStep.create as jest.Mock).mockResolvedValue(mockStep);

      const result = await repository.addStep(mockLearningPathId, dto);

      expect(result).toEqual(mockStep);
      expect(prisma.learningPathStep.create).toHaveBeenCalledWith({
        data: {
          learningPathId: mockLearningPathId,
          ...dto,
        },
      });
    });
  });

  describe('updateStepStatus', () => {
    it('should update step status', async () => {
      const dto = {
        status: StepStatus.completed,
        score: 85,
        completedAt: new Date(),
      };

      const updatedStep = {
        ...mockStep,
        ...dto,
      };

      (prisma.learningPathStep.update as jest.Mock).mockResolvedValue(
        updatedStep,
      );

      const result = await repository.updateStepStatus('step-123', dto);

      expect(result).toEqual(updatedStep);
      expect(prisma.learningPathStep.update).toHaveBeenCalledWith({
        where: { id: 'step-123' },
        data: dto,
      });
    });
  });

  describe('getNextPendingStep', () => {
    it('should get next pending step', async () => {
      (prisma.learningPathStep.findFirst as jest.Mock).mockResolvedValue(
        mockStep,
      );

      const result = await repository.getNextPendingStep(mockLearningPathId);

      expect(result).toEqual(mockStep);
      expect(prisma.learningPathStep.findFirst).toHaveBeenCalledWith({
        where: {
          learningPathId: mockLearningPathId,
          status: StepStatus.pending,
        },
        orderBy: { orderNo: 'asc' },
      });
    });

    it('should return null if no pending steps', async () => {
      (prisma.learningPathStep.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.getNextPendingStep(mockLearningPathId);

      expect(result).toBeNull();
    });
  });

  describe('findStepById', () => {
    it('should find step by ID', async () => {
      (prisma.learningPathStep.findUnique as jest.Mock).mockResolvedValue(
        mockStep,
      );

      const result = await repository.findStepById('step-123');

      expect(result).toEqual(mockStep);
    });
  });

  describe('findStepsByLearningPathId', () => {
    it('should find all steps for learning path', async () => {
      const steps = [mockStep, { ...mockStep, id: 'step-456', orderNo: 1 }];

      (prisma.learningPathStep.findMany as jest.Mock).mockResolvedValue(steps);

      const result =
        await repository.findStepsByLearningPathId(mockLearningPathId);

      expect(result).toEqual(steps);
      expect(prisma.learningPathStep.findMany).toHaveBeenCalledWith({
        where: { learningPathId: mockLearningPathId },
        orderBy: { orderNo: 'asc' },
      });
    });
  });

  describe('deleteStep', () => {
    it('should delete step', async () => {
      (prisma.learningPathStep.delete as jest.Mock).mockResolvedValue(mockStep);

      const result = await repository.deleteStep('step-123');

      expect(result).toEqual(mockStep);
      expect(prisma.learningPathStep.delete).toHaveBeenCalledWith({
        where: { id: 'step-123' },
      });
    });
  });

  describe('countStepsByStatus', () => {
    it('should count steps by status', async () => {
      (prisma.learningPathStep.count as jest.Mock).mockResolvedValue(3);

      const result = await repository.countStepsByStatus(
        mockLearningPathId,
        StepStatus.completed,
      );

      expect(result).toBe(3);
      expect(prisma.learningPathStep.count).toHaveBeenCalledWith({
        where: {
          learningPathId: mockLearningPathId,
          status: StepStatus.completed,
        },
      });
    });
  });

  describe('findByUserIdDynamic', () => {
    it('should find dynamic learning paths', async () => {
      const paths = [mockLearningPath];

      (prisma.learningPath.findMany as jest.Mock).mockResolvedValue(paths);

      const result = await repository.findByUserIdDynamic(mockUserId, true);

      expect(result).toEqual(paths);
      expect(prisma.learningPath.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isDynamic: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
