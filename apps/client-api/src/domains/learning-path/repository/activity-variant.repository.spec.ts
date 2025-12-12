import { Test, TestingModule } from '@nestjs/testing';
import { PrismaRepository } from '@app/database';
import { ActivityVariantRepository } from './activity-variant.repository';
import { ActivityType, ActivityVariant, DifficultyLevel } from '@prisma/client';

describe('ActivityVariantRepository', () => {
  let repository: ActivityVariantRepository;
  let prisma: jest.Mocked<PrismaRepository>;

  const mockVariant: ActivityVariant = {
    id: 'variant-123',
    baseActivityId: null,
    activityType: ActivityType.vocab,
    difficulty: DifficultyLevel.beginner,
    skill: 'vocabulary',
    title: 'Test Variant',
    description: 'A test variant',
    content: { questions: [] },
    mediaUrls: [],
    promptTemplateId: null,
    generationParams: null,
    aiModel: 'gemini-2.5-flash',
    usageCount: 5,
    averageScore: 75,
    feedbackCount: 2,
    isApproved: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityVariantRepository,
        {
          provide: PrismaRepository,
          useValue: {
            activityVariant: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<ActivityVariantRepository>(
      ActivityVariantRepository,
    );
    prisma = module.get(PrismaRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create activity variant', async () => {
      const data = {
        activityType: ActivityType.vocab,
        difficulty: DifficultyLevel.beginner,
        skill: 'vocabulary',
        title: 'New Variant',
        content: { questions: [] },
      };

      (prisma.activityVariant.create as jest.Mock).mockResolvedValue(
        mockVariant,
      );

      const result = await repository.create(data);

      expect(result).toEqual(mockVariant);
      expect(prisma.activityVariant.create).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find variant by ID', async () => {
      (prisma.activityVariant.findUnique as jest.Mock).mockResolvedValue(
        mockVariant,
      );

      const result = await repository.findById('variant-123');

      expect(result).toEqual(mockVariant);
    });
  });

  describe('findByTypeAndDifficulty', () => {
    it('should find variants by type and difficulty', async () => {
      const variants = [mockVariant];

      (prisma.activityVariant.findMany as jest.Mock).mockResolvedValue(
        variants,
      );

      const result = await repository.findByTypeAndDifficulty(
        ActivityType.vocab,
        DifficultyLevel.beginner,
        { limit: 10 },
      );

      expect(result).toEqual(variants);
    });
  });

  describe('updateUsageStats', () => {
    it('should increment usage count', async () => {
      (prisma.activityVariant.findUnique as jest.Mock).mockResolvedValue(
        mockVariant,
      );
      (prisma.activityVariant.update as jest.Mock).mockResolvedValue({
        ...mockVariant,
        usageCount: 6,
      });

      const result = await repository.updateUsageStats('variant-123', {
        incrementUsage: true,
      });

      expect(result.usageCount).toBe(6);
    });

    it('should update average score', async () => {
      (prisma.activityVariant.findUnique as jest.Mock).mockResolvedValue(
        mockVariant,
      );

      const newScore = 80;
      const currentTotal = mockVariant.averageScore! * mockVariant.usageCount;
      const newTotal = currentTotal + newScore;
      const newUsageCount = mockVariant.usageCount + 1;
      const newAverage = newTotal / newUsageCount;

      (prisma.activityVariant.update as jest.Mock).mockResolvedValue({
        ...mockVariant,
        usageCount: newUsageCount,
        averageScore: newAverage,
      });

      const result = await repository.updateUsageStats('variant-123', {
        score: newScore,
      });

      expect(result.averageScore).toBe(newAverage);
      expect(result.usageCount).toBe(newUsageCount);
    });
  });

  describe('approve', () => {
    it('should approve variant', async () => {
      (prisma.activityVariant.update as jest.Mock).mockResolvedValue({
        ...mockVariant,
        isApproved: true,
      });

      const result = await repository.approve('variant-123');

      expect(result.isApproved).toBe(true);
    });
  });

  describe('getRandomVariant', () => {
    it('should get random variant with weighted selection', async () => {
      const variants = [mockVariant];

      (prisma.activityVariant.findMany as jest.Mock).mockResolvedValue(
        variants,
      );

      const result = await repository.getRandomVariant(
        ActivityType.vocab,
        DifficultyLevel.beginner,
      );

      expect(result).toBeTruthy();
    });

    it('should return null if no variants found', async () => {
      (prisma.activityVariant.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.getRandomVariant(
        ActivityType.vocab,
        DifficultyLevel.beginner,
      );

      expect(result).toBeNull();
    });
  });

  describe('getStatistics', () => {
    it('should calculate statistics', async () => {
      const variants = [
        mockVariant,
        {
          ...mockVariant,
          id: 'variant-456',
          activityType: ActivityType.grammar,
          isApproved: false,
        },
      ];

      (prisma.activityVariant.findMany as jest.Mock).mockResolvedValue(
        variants,
      );

      const result = await repository.getStatistics();

      expect(result.total).toBe(2);
      expect(result.approved).toBe(1);
      expect(result.byType).toHaveProperty(ActivityType.vocab);
      expect(result.byType).toHaveProperty(ActivityType.grammar);
    });
  });
});
