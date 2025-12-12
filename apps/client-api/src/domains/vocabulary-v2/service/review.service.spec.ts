import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReviewService } from './review.service';
import { VocabularyRepository } from '../repository/vocabulary.repository';
import { SRSService } from './srs.service';
import { NotificationService } from '../../notification/service/notification.service';
import { RedisService } from '@app/shared/redis';
import { ReviewMode } from '../dto/review.dto';

describe('ReviewService', () => {
  let service: ReviewService;
  let repository: VocabularyRepository;
  let srsService: SRSService;
  let notificationService: NotificationService;
  let redisService: RedisService;

  const makeMocks = () => {
    return {
      repository: {
        getListStats: jest.fn(),
        findUserProgress: jest.fn(),
        countDueCards: jest.fn(),
        findUserReviewSessions: jest.fn(),
        findUserList: jest.fn(),
        findDueCards: jest.fn(),
        findNewCards: jest.fn(),
        findProgress: jest.fn(),
        upsertProgress: jest.fn(),
        createReviewSession: jest.fn(),
        updateUserListProgress: jest.fn(),
        getUserListStats: jest.fn(),
        countMasteredTerms: jest.fn(),
      },
      srsService: {
        calculateNextReview: jest.fn(),
        calculateStreak: jest.fn(),
      },
      notificationService: {
        create: jest.fn(),
      },
      redisService: {
        get: jest.fn(),
        set: jest.fn(),
      },
    };
  };

  beforeEach(async () => {
    const mocks = makeMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: VocabularyRepository, useValue: mocks.repository },
        { provide: SRSService, useValue: mocks.srsService },
        { provide: NotificationService, useValue: mocks.notificationService },
        { provide: RedisService, useValue: mocks.redisService },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
    repository = module.get<VocabularyRepository>(VocabularyRepository);
    srsService = module.get<SRSService>(SRSService);
    notificationService = module.get<NotificationService>(NotificationService);
    redisService = module.get<RedisService>(RedisService);

    // Mock logger to suppress logs in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats - newCount calculation', () => {
    it('should return non-negative newCount when no orphaned records', async () => {
      // Arrange: totalTerms=100, progressList has 60 studied terms
      const userId = 'user-1';
      const listId = 'list-1';

      jest.spyOn(repository, 'getListStats').mockResolvedValue({
        totalTerms: 100,
        totalUnits: 5,
      });

      jest
        .spyOn(repository, 'findUserProgress')
        .mockResolvedValue([
          ...Array(10).fill({ status: 'learning' }),
          ...Array(20).fill({ status: 'review' }),
          ...Array(30).fill({ status: 'mastered' }),
        ] as any);

      jest.spyOn(repository, 'countDueCards').mockResolvedValue(15);
      jest.spyOn(repository, 'findUserReviewSessions').mockResolvedValue([]);
      jest.spyOn(repository, 'findUserList').mockResolvedValue(null);
      jest.spyOn(srsService, 'calculateStreak').mockReturnValue({
        currentStreak: 0,
        longestStreak: 0,
      });

      // Act
      const result = await service.getStats(userId, listId);

      // Assert
      expect(result.newCount).toBe(40); // 100 - (10 + 20 + 30)
      expect(result.newCount).toBeGreaterThanOrEqual(0);
      expect(result.totalTerms).toBe(100);
      expect(result.learningCount).toBe(10);
      expect(result.reviewCount).toBe(20);
      expect(result.masteredCount).toBe(30);
    });

    it('should return zero newCount when all terms are studied', async () => {
      // Arrange: totalTerms=50, progressList has 50 studied terms
      const userId = 'user-2';
      const listId = 'list-2';

      jest.spyOn(repository, 'getListStats').mockResolvedValue({
        totalTerms: 50,
        totalUnits: 3,
      });

      jest
        .spyOn(repository, 'findUserProgress')
        .mockResolvedValue([
          ...Array(10).fill({ status: 'learning' }),
          ...Array(15).fill({ status: 'review' }),
          ...Array(25).fill({ status: 'mastered' }),
        ] as any);

      jest.spyOn(repository, 'countDueCards').mockResolvedValue(8);
      jest.spyOn(repository, 'findUserReviewSessions').mockResolvedValue([]);
      jest.spyOn(repository, 'findUserList').mockResolvedValue(null);
      jest.spyOn(srsService, 'calculateStreak').mockReturnValue({
        currentStreak: 5,
        longestStreak: 10,
      });

      // Act
      const result = await service.getStats(userId, listId);

      // Assert
      expect(result.newCount).toBe(0); // 50 - (10 + 15 + 25) = 0
      expect(result.newCount).toBeGreaterThanOrEqual(0);
    });

    it('should return non-negative newCount with orphaned records (bug fix)', async () => {
      // Arrange: totalTerms=10, progressList has 15 studied terms (orphaned data)
      const userId = 'user-3';
      const listId = 'list-3';

      jest.spyOn(repository, 'getListStats').mockResolvedValue({
        totalTerms: 10,
        totalUnits: 1,
      });

      jest
        .spyOn(repository, 'findUserProgress')
        .mockResolvedValue([
          ...Array(5).fill({ status: 'learning' }),
          ...Array(4).fill({ status: 'review' }),
          ...Array(6).fill({ status: 'mastered' }),
        ] as any);

      jest.spyOn(repository, 'countDueCards').mockResolvedValue(3);
      jest.spyOn(repository, 'findUserReviewSessions').mockResolvedValue([]);
      jest.spyOn(repository, 'findUserList').mockResolvedValue(null);
      jest.spyOn(srsService, 'calculateStreak').mockReturnValue({
        currentStreak: 0,
        longestStreak: 0,
      });

      jest.spyOn(Logger.prototype, 'warn');

      // Act
      const result = await service.getStats(userId, listId);

      // Assert
      expect(result.newCount).toBe(0); // Math.max(0, 10 - 15) = 0
      expect(result.newCount).toBeGreaterThanOrEqual(0);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Stats count mismatch detected',
        expect.objectContaining({
          userId,
          listId,
          totalTerms: 10,
          studiedCount: 15,
        }),
      );
    });

    it('should calculate newCount correctly with only learning status', async () => {
      const userId = 'user-4';
      const listId = 'list-4';

      jest.spyOn(repository, 'getListStats').mockResolvedValue({
        totalTerms: 30,
        totalUnits: 2,
      });

      jest
        .spyOn(repository, 'findUserProgress')
        .mockResolvedValue([...Array(12).fill({ status: 'learning' })] as any);

      jest.spyOn(repository, 'countDueCards').mockResolvedValue(12);
      jest.spyOn(repository, 'findUserReviewSessions').mockResolvedValue([]);
      jest.spyOn(repository, 'findUserList').mockResolvedValue(null);
      jest.spyOn(srsService, 'calculateStreak').mockReturnValue({
        currentStreak: 2,
        longestStreak: 5,
      });

      // Act
      const result = await service.getStats(userId, listId);

      // Assert
      expect(result.newCount).toBe(18); // 30 - 12
      expect(result.learningCount).toBe(12);
      expect(result.reviewCount).toBe(0);
      expect(result.masteredCount).toBe(0);
    });
  });

  describe('startSession - session count logic', () => {
    it('should return totalDue matching actual due cards count', async () => {
      // Arrange
      const userId = 'user-5';
      const dto = {
        listId: 'list-5',
        mode: ReviewMode.FLASHCARD,
        limit: 50,
        includeNew: false,
        includeReview: true,
      };

      const mockDueCards = Array(6).fill({
        status: 'learning',
        nextReviewAt: new Date(),
        correctCount: 2,
        wrongCount: 1,
        repetitions: 3,
        lastReviewAt: new Date(),
        term: {
          id: 'term-1',
          unitId: 'unit-1',
          word: 'test',
          definition: 'definition',
          orderIndex: 0,
          difficulty: 'medium',
          synonyms: [],
          antonyms: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      jest.spyOn(repository, 'countDueCards').mockResolvedValue(6);
      jest
        .spyOn(repository, 'findDueCards')
        .mockResolvedValue(mockDueCards as any);

      // Act
      const result = await service.startSession(userId, dto);

      // Assert
      expect(result.totalDue).toBe(6); // True count from countDueCards
      expect(result.terms.length).toBe(6); // Actual returned cards
      expect(result.returnedCount).toBe(6);
      expect(repository.countDueCards).toHaveBeenCalledWith(userId, {
        listId: 'list-5',
        statusFilter: ['learning', 'review'],
      });
      expect(repository.findDueCards).toHaveBeenCalledWith(userId, {
        listId: 'list-5',
        limit: 6,
        statusFilter: ['learning', 'review'],
      });
    });

    it('should cap returned cards at limit while showing true totalDue', async () => {
      // Arrange: 100 due cards, limit=20
      const userId = 'user-6';
      const dto = {
        listId: 'list-6',
        mode: ReviewMode.FLASHCARD,
        limit: 20,
        includeNew: false,
        includeReview: true,
      };

      const mockDueCards = Array(20).fill({
        status: 'review',
        nextReviewAt: new Date(),
        correctCount: 5,
        wrongCount: 0,
        repetitions: 6,
        lastReviewAt: new Date(),
        term: {
          id: 'term-2',
          unitId: 'unit-2',
          word: 'example',
          definition: 'example definition',
          orderIndex: 0,
          difficulty: 'hard',
          synonyms: [],
          antonyms: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      jest.spyOn(repository, 'countDueCards').mockResolvedValue(100);
      jest
        .spyOn(repository, 'findDueCards')
        .mockResolvedValue(mockDueCards as any);

      // Act
      const result = await service.startSession(userId, dto);

      // Assert
      expect(result.totalDue).toBe(100); // True total count
      expect(result.returnedCount).toBe(20); // Capped at limit
      expect(result.terms.length).toBe(20);
      expect(repository.findDueCards).toHaveBeenCalledWith(userId, {
        listId: 'list-6',
        limit: 20,
        statusFilter: ['learning', 'review'],
      });
    });

    it('should include new cards when includeNew=true and space available', async () => {
      const userId = 'user-7';
      const dto = {
        listId: 'list-7',
        mode: ReviewMode.FLASHCARD,
        limit: 20,
        includeNew: true,
        includeReview: true,
      };

      const mockDueCards = Array(10).fill({
        status: 'learning',
        nextReviewAt: new Date(),
        correctCount: 1,
        wrongCount: 0,
        repetitions: 1,
        lastReviewAt: new Date(),
        term: {
          id: 'term-3',
          unitId: 'unit-3',
          word: 'due',
          definition: 'due definition',
          orderIndex: 0,
          difficulty: 'easy',
          synonyms: [],
          antonyms: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const mockNewCards = Array(10).fill({
        id: 'term-4',
        unitId: 'unit-4',
        word: 'new',
        definition: 'new definition',
        orderIndex: 0,
        difficulty: 'medium',
        synonyms: [],
        antonyms: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(repository, 'countDueCards').mockResolvedValue(10);
      jest
        .spyOn(repository, 'findDueCards')
        .mockResolvedValue(mockDueCards as any);
      jest
        .spyOn(repository, 'findNewCards')
        .mockResolvedValue(mockNewCards as any);

      // Act
      const result = await service.startSession(userId, dto);

      // Assert
      expect(result.totalDue).toBe(10);
      expect(result.newCount).toBe(10);
      expect(result.returnedCount).toBe(20);
      expect(result.terms.length).toBe(20);
    });

    it('should apply statusFilter correctly (learning and review only)', async () => {
      const userId = 'user-8';
      const dto = {
        listId: 'list-8',
        mode: ReviewMode.FLASHCARD,
        limit: 30,
        includeNew: false,
        includeReview: true,
      };

      jest.spyOn(repository, 'countDueCards').mockResolvedValue(25);
      jest.spyOn(repository, 'findDueCards').mockResolvedValue([]);

      // Act
      await service.startSession(userId, dto);

      // Assert
      expect(repository.countDueCards).toHaveBeenCalledWith(userId, {
        listId: 'list-8',
        statusFilter: ['learning', 'review'],
      });
      expect(repository.findDueCards).toHaveBeenCalledWith(userId, {
        listId: 'list-8',
        limit: 25,
        statusFilter: ['learning', 'review'],
      });
    });

    it('should handle zero due cards correctly', async () => {
      const userId = 'user-9';
      const dto = {
        listId: 'list-9',
        mode: ReviewMode.FLASHCARD,
        limit: 20,
        includeNew: false,
        includeReview: true,
      };

      jest.spyOn(repository, 'countDueCards').mockResolvedValue(0);
      jest.spyOn(repository, 'findDueCards').mockResolvedValue([]);

      // Act
      const result = await service.startSession(userId, dto);

      // Assert
      expect(result.totalDue).toBe(0);
      expect(result.returnedCount).toBe(0);
      expect(result.terms.length).toBe(0);
    });
  });

  describe('getStats - dueToday count', () => {
    it('should use countDueCards for accurate dueToday count', async () => {
      const userId = 'user-10';
      const listId = 'list-10';

      jest.spyOn(repository, 'getListStats').mockResolvedValue({
        totalTerms: 50,
        totalUnits: 3,
      });

      jest
        .spyOn(repository, 'findUserProgress')
        .mockResolvedValue([
          ...Array(20).fill({ status: 'learning' }),
          ...Array(15).fill({ status: 'review' }),
          ...Array(10).fill({ status: 'mastered' }),
        ] as any);

      jest.spyOn(repository, 'countDueCards').mockResolvedValue(12);
      jest.spyOn(repository, 'findUserReviewSessions').mockResolvedValue([]);
      jest.spyOn(repository, 'findUserList').mockResolvedValue(null);
      jest.spyOn(srsService, 'calculateStreak').mockReturnValue({
        currentStreak: 3,
        longestStreak: 7,
      });

      // Act
      const result = await service.getStats(userId, listId);

      // Assert
      expect(result.dueToday).toBe(12);
      expect(repository.countDueCards).toHaveBeenCalledWith(userId, {
        listId,
        statusFilter: ['learning', 'review'],
      });
    });
  });
});
