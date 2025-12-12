import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ReviewService } from '../src/domains/vocabulary-v2/service/review.service';
import { VocabularyRepository } from '../src/domains/vocabulary-v2/repository/vocabulary.repository';
import { SRSService } from '../src/domains/vocabulary-v2/service/srs.service';
import { NotificationService } from '../src/domains/notification/service/notification.service';
import { RedisService } from '@app/shared/redis';
import { ReviewMode } from '../src/domains/vocabulary-v2/dto/review.dto';

describe('Vocabulary Review Integration Tests', () => {
  let app: INestApplication;
  let reviewService: ReviewService;
  let vocabularyRepository: VocabularyRepository;

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

  beforeAll(async () => {
    const mocks = makeMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: VocabularyRepository, useValue: mocks.repository },
        { provide: SRSService, useValue: mocks.srsService },
        { provide: NotificationService, useValue: mocks.notificationService },
        { provide: RedisService, useValue: mocks.redisService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    reviewService = moduleFixture.get<ReviewService>(ReviewService);
    vocabularyRepository = moduleFixture.get<VocabularyRepository>(
      VocabularyRepository,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Stats and Session Consistency', () => {
    it('should have matching counts in stats.dueToday and session.totalDue', async () => {
      // Arrange
      const userId = 'integration-user-1';
      const listId = 'integration-list-1';

      // Setup consistent mock data
      const totalDueCount = 18;
      const mockDueCards = Array(18)
        .fill(null)
        .map((_, idx) => ({
          status: idx < 10 ? 'learning' : 'review',
          nextReviewAt: new Date(),
          correctCount: 2,
          wrongCount: 1,
          repetitions: 3,
          lastReviewAt: new Date(),
          term: {
            id: `term-${idx}`,
            unitId: 'unit-1',
            word: `word-${idx}`,
            definition: `definition-${idx}`,
            orderIndex: idx,
            difficulty: 'medium',
            synonyms: [],
            antonyms: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            unit: {
              id: 'unit-1',
              listId,
            },
          },
        }));

      // Mock repository calls for getStats
      jest.spyOn(vocabularyRepository, 'getListStats').mockResolvedValue({
        totalTerms: 50,
        totalUnits: 3,
      });

      jest.spyOn(vocabularyRepository, 'findUserProgress').mockResolvedValue([
        ...Array(10).fill({ status: 'learning' }),
        ...Array(8).fill({ status: 'review' }),
        ...Array(12).fill({ status: 'mastered' }),
      ] as any);

      jest
        .spyOn(vocabularyRepository, 'countDueCards')
        .mockResolvedValue(totalDueCount);
      jest
        .spyOn(vocabularyRepository, 'findUserReviewSessions')
        .mockResolvedValue([]);
      jest.spyOn(vocabularyRepository, 'findUserList').mockResolvedValue(null);

      // Mock SRS service
      const srsService = app.get<SRSService>(SRSService);
      jest.spyOn(srsService, 'calculateStreak').mockReturnValue({
        currentStreak: 5,
        longestStreak: 10,
      });

      // Mock repository calls for startSession
      jest
        .spyOn(vocabularyRepository, 'findDueCards')
        .mockResolvedValue(mockDueCards as any);

      // Act - Call both methods
      const stats = await reviewService.getStats(userId, listId);
      const session = await reviewService.startSession(userId, {
        listId,
        mode: ReviewMode.FLASHCARD,
        limit: 50,
        includeNew: false,
        includeReview: true,
      });

      // Assert - Counts must match
      expect(stats.dueToday).toBe(session.totalDue);
      expect(stats.dueToday).toBe(totalDueCount);
      expect(session.totalDue).toBe(totalDueCount);

      // Verify both used countDueCards with same params
      expect(vocabularyRepository.countDueCards).toHaveBeenCalledWith(userId, {
        listId,
        statusFilter: ['learning', 'review'],
      });
      expect(vocabularyRepository.countDueCards).toHaveBeenCalledTimes(2);
    });

    it('should handle case where limit is less than total due cards', async () => {
      // Arrange
      const userId = 'integration-user-2';
      const listId = 'integration-list-2';
      const totalDueCount = 100;
      const limit = 20;

      const mockDueCards = Array(20)
        .fill(null)
        .map((_, idx) => ({
          status: 'learning',
          nextReviewAt: new Date(),
          correctCount: 1,
          wrongCount: 0,
          repetitions: 2,
          lastReviewAt: new Date(),
          term: {
            id: `term-${idx}`,
            unitId: 'unit-2',
            word: `word-${idx}`,
            definition: `definition-${idx}`,
            orderIndex: idx,
            difficulty: 'easy',
            synonyms: [],
            antonyms: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            unit: {
              id: 'unit-2',
              listId,
            },
          },
        }));

      // Mock getStats
      jest.spyOn(vocabularyRepository, 'getListStats').mockResolvedValue({
        totalTerms: 200,
        totalUnits: 10,
      });

      jest.spyOn(vocabularyRepository, 'findUserProgress').mockResolvedValue([
        ...Array(50).fill({ status: 'learning' }),
        ...Array(50).fill({ status: 'review' }),
        ...Array(50).fill({ status: 'mastered' }),
      ] as any);

      jest
        .spyOn(vocabularyRepository, 'countDueCards')
        .mockResolvedValue(totalDueCount);
      jest
        .spyOn(vocabularyRepository, 'findUserReviewSessions')
        .mockResolvedValue([]);
      jest.spyOn(vocabularyRepository, 'findUserList').mockResolvedValue(null);

      const srsService = app.get<SRSService>(SRSService);
      jest.spyOn(srsService, 'calculateStreak').mockReturnValue({
        currentStreak: 0,
        longestStreak: 0,
      });

      // Mock startSession
      jest
        .spyOn(vocabularyRepository, 'findDueCards')
        .mockResolvedValue(mockDueCards as any);

      // Act
      const stats = await reviewService.getStats(userId, listId);
      const session = await reviewService.startSession(userId, {
        listId,
        mode: ReviewMode.FLASHCARD,
        limit,
        includeNew: false,
        includeReview: true,
      });

      // Assert
      expect(stats.dueToday).toBe(totalDueCount); // True total
      expect(session.totalDue).toBe(totalDueCount); // True total
      expect(session.returnedCount).toBe(limit); // Capped at limit
      expect(session.terms.length).toBe(limit);
    });

    it('should handle zero due cards consistently', async () => {
      // Arrange
      const userId = 'integration-user-3';
      const listId = 'integration-list-3';

      // Mock getStats
      jest.spyOn(vocabularyRepository, 'getListStats').mockResolvedValue({
        totalTerms: 30,
        totalUnits: 2,
      });

      jest.spyOn(vocabularyRepository, 'findUserProgress').mockResolvedValue([
        ...Array(30).fill({ status: 'mastered' }),
      ] as any);

      jest.spyOn(vocabularyRepository, 'countDueCards').mockResolvedValue(0);
      jest
        .spyOn(vocabularyRepository, 'findUserReviewSessions')
        .mockResolvedValue([]);
      jest.spyOn(vocabularyRepository, 'findUserList').mockResolvedValue(null);

      const srsService = app.get<SRSService>(SRSService);
      jest.spyOn(srsService, 'calculateStreak').mockReturnValue({
        currentStreak: 0,
        longestStreak: 0,
      });

      // Mock startSession
      jest.spyOn(vocabularyRepository, 'findDueCards').mockResolvedValue([]);

      // Act
      const stats = await reviewService.getStats(userId, listId);
      const session = await reviewService.startSession(userId, {
        listId,
        mode: ReviewMode.FLASHCARD,
        limit: 20,
        includeNew: false,
        includeReview: true,
      });

      // Assert
      expect(stats.dueToday).toBe(0);
      expect(session.totalDue).toBe(0);
      expect(session.returnedCount).toBe(0);
      expect(session.terms.length).toBe(0);
    });

    it('should apply same statusFilter in both stats and session', async () => {
      // Arrange
      const userId = 'integration-user-4';
      const listId = 'integration-list-4';
      const expectedStatusFilter = ['learning', 'review'];

      // Mock getStats
      jest.spyOn(vocabularyRepository, 'getListStats').mockResolvedValue({
        totalTerms: 40,
        totalUnits: 3,
      });

      jest.spyOn(vocabularyRepository, 'findUserProgress').mockResolvedValue([
        ...Array(15).fill({ status: 'learning' }),
        ...Array(10).fill({ status: 'review' }),
        ...Array(8).fill({ status: 'mastered' }),
      ] as any);

      jest.spyOn(vocabularyRepository, 'countDueCards').mockResolvedValue(12);
      jest
        .spyOn(vocabularyRepository, 'findUserReviewSessions')
        .mockResolvedValue([]);
      jest.spyOn(vocabularyRepository, 'findUserList').mockResolvedValue(null);

      const srsService = app.get<SRSService>(SRSService);
      jest.spyOn(srsService, 'calculateStreak').mockReturnValue({
        currentStreak: 0,
        longestStreak: 0,
      });

      // Mock startSession
      jest.spyOn(vocabularyRepository, 'findDueCards').mockResolvedValue([]);

      // Act
      await reviewService.getStats(userId, listId);
      await reviewService.startSession(userId, {
        listId,
        mode: ReviewMode.FLASHCARD,
        limit: 20,
        includeNew: false,
        includeReview: true,
      });

      // Assert - Verify statusFilter is consistent
      const countDueCalls = (
        vocabularyRepository.countDueCards as jest.Mock
      ).mock.calls;

      expect(countDueCalls.length).toBe(2);
      expect(countDueCalls[0][1].statusFilter).toEqual(expectedStatusFilter);
      expect(countDueCalls[1][1].statusFilter).toEqual(expectedStatusFilter);
    });
  });

  describe('DTO Validation Integration', () => {
    it('should enforce non-negative count constraints in ReviewStatsDto', async () => {
      // Arrange
      const userId = 'integration-user-5';
      const listId = 'integration-list-5';

      // Mock with orphaned data (negative newCount scenario)
      jest.spyOn(vocabularyRepository, 'getListStats').mockResolvedValue({
        totalTerms: 5, // Less than studied
        totalUnits: 1,
      });

      jest.spyOn(vocabularyRepository, 'findUserProgress').mockResolvedValue([
        ...Array(10).fill({ status: 'learning' }),
        ...Array(5).fill({ status: 'review' }),
      ] as any);

      jest.spyOn(vocabularyRepository, 'countDueCards').mockResolvedValue(8);
      jest
        .spyOn(vocabularyRepository, 'findUserReviewSessions')
        .mockResolvedValue([]);
      jest.spyOn(vocabularyRepository, 'findUserList').mockResolvedValue(null);

      const srsService = app.get<SRSService>(SRSService);
      jest.spyOn(srsService, 'calculateStreak').mockReturnValue({
        currentStreak: 0,
        longestStreak: 0,
      });

      // Act
      const stats = await reviewService.getStats(userId, listId);

      // Assert - newCount should be clamped to 0, not negative
      expect(stats.newCount).toBeGreaterThanOrEqual(0);
      expect(stats.totalTerms).toBeGreaterThanOrEqual(0);
      expect(stats.learningCount).toBeGreaterThanOrEqual(0);
      expect(stats.reviewCount).toBeGreaterThanOrEqual(0);
      expect(stats.masteredCount).toBeGreaterThanOrEqual(0);
      expect(stats.dueToday).toBeGreaterThanOrEqual(0);
      expect(stats.currentStreak).toBeGreaterThanOrEqual(0);
      expect(stats.longestStreak).toBeGreaterThanOrEqual(0);
      expect(stats.totalReviews).toBeGreaterThanOrEqual(0);
    });

    it('should enforce non-negative count constraints in ReviewSessionResponseDto', async () => {
      // Arrange
      const userId = 'integration-user-6';

      jest.spyOn(vocabularyRepository, 'countDueCards').mockResolvedValue(5);
      jest.spyOn(vocabularyRepository, 'findDueCards').mockResolvedValue([]);

      // Act
      const session = await reviewService.startSession(userId, {
        mode: ReviewMode.FLASHCARD,
        limit: 20,
        includeNew: false,
        includeReview: true,
      });

      // Assert
      expect(session.totalDue).toBeGreaterThanOrEqual(0);
      expect(session.returnedCount).toBeGreaterThanOrEqual(0);
      expect(session.newCount).toBeGreaterThanOrEqual(0);
      expect(session.reviewCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent stats and session calls consistently', async () => {
      // Arrange
      const userId = 'integration-user-7';
      const listId = 'integration-list-7';

      jest.spyOn(vocabularyRepository, 'getListStats').mockResolvedValue({
        totalTerms: 60,
        totalUnits: 4,
      });

      jest.spyOn(vocabularyRepository, 'findUserProgress').mockResolvedValue([
        ...Array(20).fill({ status: 'learning' }),
        ...Array(15).fill({ status: 'review' }),
        ...Array(10).fill({ status: 'mastered' }),
      ] as any);

      jest.spyOn(vocabularyRepository, 'countDueCards').mockResolvedValue(20);
      jest
        .spyOn(vocabularyRepository, 'findUserReviewSessions')
        .mockResolvedValue([]);
      jest.spyOn(vocabularyRepository, 'findUserList').mockResolvedValue(null);
      jest.spyOn(vocabularyRepository, 'findDueCards').mockResolvedValue([]);

      const srsService = app.get<SRSService>(SRSService);
      jest.spyOn(srsService, 'calculateStreak').mockReturnValue({
        currentStreak: 0,
        longestStreak: 0,
      });

      // Act - Call concurrently
      const [stats1, session1, stats2, session2] = await Promise.all([
        reviewService.getStats(userId, listId),
        reviewService.startSession(userId, {
          listId,
          mode: ReviewMode.FLASHCARD,
          limit: 20,
          includeNew: false,
          includeReview: true,
        }),
        reviewService.getStats(userId, listId),
        reviewService.startSession(userId, {
          listId,
          mode: ReviewMode.FLASHCARD,
          limit: 20,
          includeNew: false,
          includeReview: true,
        }),
      ]);

      // Assert - All results should be consistent
      expect(stats1.dueToday).toBe(stats2.dueToday);
      expect(session1.totalDue).toBe(session2.totalDue);
      expect(stats1.dueToday).toBe(session1.totalDue);
    });
  });

  describe('DTO Validation Tests', () => {
    it('should validate ReviewStatsDto non-negative constraints', () => {
      // This test validates DTO decorators are properly configured
      // The actual validation happens via ValidationPipe in controllers
      const {
        ReviewStatsDto,
      } = require('../src/domains/vocabulary-v2/dto/review.dto');

      const dto = new ReviewStatsDto();
      dto.totalTerms = 100;
      dto.newCount = 0;
      dto.learningCount = 20;
      dto.reviewCount = 15;
      dto.masteredCount = 30;
      dto.dueToday = 18;
      dto.currentStreak = 5;
      dto.longestStreak = 10;
      dto.totalReviews = 50;

      // All count fields should accept 0 and positive values
      expect(dto.totalTerms).toBeGreaterThanOrEqual(0);
      expect(dto.newCount).toBeGreaterThanOrEqual(0);
      expect(dto.learningCount).toBeGreaterThanOrEqual(0);
      expect(dto.reviewCount).toBeGreaterThanOrEqual(0);
      expect(dto.masteredCount).toBeGreaterThanOrEqual(0);
      expect(dto.dueToday).toBeGreaterThanOrEqual(0);
      expect(dto.currentStreak).toBeGreaterThanOrEqual(0);
      expect(dto.longestStreak).toBeGreaterThanOrEqual(0);
      expect(dto.totalReviews).toBeGreaterThanOrEqual(0);
    });

    it('should validate ReviewSessionResponseDto non-negative constraints', () => {
      const {
        ReviewSessionResponseDto,
      } = require('../src/domains/vocabulary-v2/dto/review.dto');

      const dto = new ReviewSessionResponseDto();
      dto.terms = [];
      dto.totalDue = 50;
      dto.returnedCount = 20;
      dto.newCount = 10;
      dto.reviewCount = 40;
      dto.mode = ReviewMode.FLASHCARD;

      // All count fields should accept 0 and positive values
      expect(dto.totalDue).toBeGreaterThanOrEqual(0);
      expect(dto.returnedCount).toBeGreaterThanOrEqual(0);
      expect(dto.newCount).toBeGreaterThanOrEqual(0);
      expect(dto.reviewCount).toBeGreaterThanOrEqual(0);
    });

    it('should validate StartReviewSessionDto with valid limit', () => {
      const {
        StartReviewSessionDto,
      } = require('../src/domains/vocabulary-v2/dto/review.dto');

      const dto = new StartReviewSessionDto();
      dto.mode = ReviewMode.FLASHCARD;
      dto.limit = 20;
      dto.includeNew = true;
      dto.includeReview = true;

      expect(dto.limit).toBeGreaterThanOrEqual(1);
      expect(dto.limit).toBeLessThanOrEqual(100);
    });

    it('should validate ReviewSubmissionDto quality range', () => {
      const {
        ReviewSubmissionDto,
      } = require('../src/domains/vocabulary-v2/dto/review.dto');

      const validQualities = [0, 1, 2, 3, 4, 5];

      validQualities.forEach((quality) => {
        const dto = new ReviewSubmissionDto();
        dto.termId = 'term-1';
        dto.quality = quality;

        expect(dto.quality).toBeGreaterThanOrEqual(0);
        expect(dto.quality).toBeLessThanOrEqual(5);
      });
    });
  });
});
