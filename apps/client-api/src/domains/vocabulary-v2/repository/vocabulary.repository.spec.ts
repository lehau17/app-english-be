import { Test, TestingModule } from '@nestjs/testing';
import { VocabularyRepository } from './vocabulary.repository';
import { PrismaRepository } from '@app/database';

describe('VocabularyRepository', () => {
  let repository: VocabularyRepository;
  let prisma: PrismaRepository;

  const makeMocks = () => {
    return {
      prisma: {
        userVocabularyProgress: {
          count: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          upsert: jest.fn(),
          delete: jest.fn(),
          groupBy: jest.fn(),
        },
        vocabularyList: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          count: jest.fn(),
        },
        vocabularyUnit: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        vocabularyTerm: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          createMany: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          count: jest.fn(),
        },
        userVocabularyList: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        vocabularyReviewSession: {
          create: jest.fn(),
          findMany: jest.fn(),
        },
        $transaction: jest.fn(),
      },
    };
  };

  beforeEach(async () => {
    const mocks = makeMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VocabularyRepository,
        { provide: PrismaRepository, useValue: mocks.prisma },
      ],
    }).compile();

    repository = module.get<VocabularyRepository>(VocabularyRepository);
    prisma = module.get<PrismaRepository>(PrismaRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('countDueCards', () => {
    it('should count due cards without filters', async () => {
      // Arrange
      const userId = 'user-1';
      const now = new Date();

      jest.spyOn(prisma.userVocabularyProgress, 'count').mockResolvedValue(15);

      // Act
      const result = await repository.countDueCards(userId);

      // Assert
      expect(result).toBe(15);
      expect(prisma.userVocabularyProgress.count).toHaveBeenCalledWith({
        where: {
          userId,
          nextReviewAt: { lte: expect.any(Date) },
        },
      });
    });

    it('should count due cards with listId filter', async () => {
      // Arrange
      const userId = 'user-2';
      const listId = 'list-2';

      jest.spyOn(prisma.userVocabularyProgress, 'count').mockResolvedValue(23);

      // Act
      const result = await repository.countDueCards(userId, { listId });

      // Assert
      expect(result).toBe(23);
      expect(prisma.userVocabularyProgress.count).toHaveBeenCalledWith({
        where: {
          userId,
          nextReviewAt: { lte: expect.any(Date) },
          term: { unit: { listId } },
        },
      });
    });

    it('should count due cards with statusFilter', async () => {
      // Arrange
      const userId = 'user-3';
      const statusFilter = ['learning', 'review'] as const;

      jest.spyOn(prisma.userVocabularyProgress, 'count').mockResolvedValue(8);

      // Act
      const result = await repository.countDueCards(userId, { statusFilter });

      // Assert
      expect(result).toBe(8);
      expect(prisma.userVocabularyProgress.count).toHaveBeenCalledWith({
        where: {
          userId,
          nextReviewAt: { lte: expect.any(Date) },
          status: { in: statusFilter },
        },
      });
    });

    it('should count due cards with both listId and statusFilter', async () => {
      // Arrange
      const userId = 'user-4';
      const listId = 'list-4';
      const statusFilter = ['learning', 'review'] as const;

      jest.spyOn(prisma.userVocabularyProgress, 'count').mockResolvedValue(12);

      // Act
      const result = await repository.countDueCards(userId, {
        listId,
        statusFilter,
      });

      // Assert
      expect(result).toBe(12);
      expect(prisma.userVocabularyProgress.count).toHaveBeenCalledWith({
        where: {
          userId,
          nextReviewAt: { lte: expect.any(Date) },
          term: { unit: { listId } },
          status: { in: statusFilter },
        },
      });
    });

    it('should return zero when no due cards', async () => {
      // Arrange
      const userId = 'user-5';

      jest.spyOn(prisma.userVocabularyProgress, 'count').mockResolvedValue(0);

      // Act
      const result = await repository.countDueCards(userId);

      // Assert
      expect(result).toBe(0);
    });

    it('should count only cards due before current time', async () => {
      // Arrange
      const userId = 'user-6';
      const listId = 'list-6';

      jest.spyOn(prisma.userVocabularyProgress, 'count').mockResolvedValue(5);

      // Act
      const beforeCall = new Date();
      await repository.countDueCards(userId, { listId });
      const afterCall = new Date();

      // Assert
      const callArgs = (prisma.userVocabularyProgress.count as jest.Mock).mock.calls[0][0];
      const nextReviewAt = callArgs.where.nextReviewAt.lte;

      expect(nextReviewAt).toBeInstanceOf(Date);
      expect(nextReviewAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(nextReviewAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('should handle empty statusFilter array', async () => {
      // Arrange
      const userId = 'user-7';
      const statusFilter = [] as ('learning' | 'review')[];

      jest.spyOn(prisma.userVocabularyProgress, 'count').mockResolvedValue(10);

      // Act
      const result = await repository.countDueCards(userId, { statusFilter });

      // Assert
      expect(result).toBe(10);
      // Should not include status filter when array is empty
      expect(prisma.userVocabularyProgress.count).toHaveBeenCalledWith({
        where: {
          userId,
          nextReviewAt: { lte: expect.any(Date) },
        },
      });
    });
  });

  describe('findDueCards', () => {
    const mockProgressWithTerm = {
      status: 'learning',
      nextReviewAt: new Date(),
      correctCount: 3,
      wrongCount: 1,
      repetitions: 4,
      lastReviewAt: new Date(),
      term: {
        id: 'term-1',
        unitId: 'unit-1',
        word: 'example',
        definition: 'definition',
        orderIndex: 0,
        difficulty: 'medium',
        synonyms: [],
        antonyms: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        unit: {
          id: 'unit-1',
          listId: 'list-1',
          title: 'Unit 1',
          orderIndex: 0,
        },
      },
    };

    it('should find due cards with statusFilter', async () => {
      // Arrange
      const userId = 'user-8';
      const listId = 'list-8';
      const statusFilter = ['learning', 'review'] as const;

      jest
        .spyOn(prisma.userVocabularyProgress, 'findMany')
        .mockResolvedValue([mockProgressWithTerm] as any);

      // Act
      const result = await repository.findDueCards(userId, {
        listId,
        limit: 20,
        statusFilter,
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(prisma.userVocabularyProgress.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          nextReviewAt: { lte: expect.any(Date) },
          term: { unit: { listId } },
          status: { in: statusFilter },
        },
        take: 20,
        orderBy: { nextReviewAt: 'asc' },
        include: {
          term: {
            include: {
              unit: true,
            },
          },
        },
      });
    });

    it('should respect limit parameter', async () => {
      // Arrange
      const userId = 'user-9';
      const limit = 5;

      jest
        .spyOn(prisma.userVocabularyProgress, 'findMany')
        .mockResolvedValue([mockProgressWithTerm] as any);

      // Act
      await repository.findDueCards(userId, { limit });

      // Assert
      expect(prisma.userVocabularyProgress.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        take: 5,
        orderBy: { nextReviewAt: 'asc' },
        include: expect.any(Object),
      });
    });

    it('should use default limit when not specified', async () => {
      // Arrange
      const userId = 'user-10';

      jest
        .spyOn(prisma.userVocabularyProgress, 'findMany')
        .mockResolvedValue([mockProgressWithTerm] as any);

      // Act
      await repository.findDueCards(userId);

      // Assert
      expect(prisma.userVocabularyProgress.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        take: 20, // Default limit
        orderBy: { nextReviewAt: 'asc' },
        include: expect.any(Object),
      });
    });

    it('should order by nextReviewAt ascending', async () => {
      // Arrange
      const userId = 'user-11';

      jest
        .spyOn(prisma.userVocabularyProgress, 'findMany')
        .mockResolvedValue([mockProgressWithTerm] as any);

      // Act
      await repository.findDueCards(userId, { limit: 10 });

      // Assert
      expect(prisma.userVocabularyProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { nextReviewAt: 'asc' },
        }),
      );
    });
  });

  describe('getUserListStats', () => {
    it('should calculate stats correctly from groupBy results', async () => {
      // Arrange
      const userId = 'user-12';
      const listId = 'list-12';

      jest.spyOn(prisma.userVocabularyProgress, 'groupBy').mockResolvedValue([
        { status: 'learning', _count: 10 },
        { status: 'review', _count: 15 },
        { status: 'mastered', _count: 25 },
      ] as any);

      jest.spyOn(prisma.userVocabularyProgress, 'count').mockResolvedValue(20);

      // Act
      const result = await repository.getUserListStats(userId, listId);

      // Assert
      expect(result).toEqual({
        newCount: 0,
        learningCount: 10,
        reviewCount: 15,
        masteredCount: 25,
        dueToday: 20,
      });
    });

    it('should handle missing statuses in groupBy results', async () => {
      // Arrange
      const userId = 'user-13';
      const listId = 'list-13';

      jest.spyOn(prisma.userVocabularyProgress, 'groupBy').mockResolvedValue([
        { status: 'learning', _count: 5 },
      ] as any);

      jest.spyOn(prisma.userVocabularyProgress, 'count').mockResolvedValue(3);

      // Act
      const result = await repository.getUserListStats(userId, listId);

      // Assert
      expect(result).toEqual({
        newCount: 0,
        learningCount: 5,
        reviewCount: 0,
        masteredCount: 0,
        dueToday: 3,
      });
    });
  });
});
