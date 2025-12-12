import { Test, TestingModule } from '@nestjs/testing';
import { SRSSchedulerService } from './srs-scheduler.service';
import { SkillProgressRepository } from '../repository/skill-progress.repository';

describe('SRSSchedulerService', () => {
  let service: SRSSchedulerService;
  let skillProgressRepo: jest.Mocked<SkillProgressRepository>;

  beforeEach(async () => {
    const mockSkillProgressRepo = {
      findOrCreate: jest.fn(),
      updateProgress: jest.fn(),
      findDueForReview: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SRSSchedulerService,
        {
          provide: SkillProgressRepository,
          useValue: mockSkillProgressRepo,
        },
      ],
    }).compile();

    service = module.get<SRSSchedulerService>(SRSSchedulerService);
    skillProgressRepo = module.get(SkillProgressRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateSM2', () => {
    it('should calculate correct interval for perfect quality (5)', () => {
      const result = service.calculateSM2(2.5, 1, 5);

      expect(result.interval).toBeGreaterThan(1);
      expect(result.easeFactor).toBeGreaterThanOrEqual(2.5);
      expect(result.repetitions).toBeDefined();
    });

    it('should reset interval on failure (quality < 3)', () => {
      const result = service.calculateSM2(2.5, 7, 2);

      expect(result.interval).toBe(1); // Reset to minimum
      expect(result.repetitions).toBe(0);
    });

    it('should increase interval for good response (quality 4)', () => {
      const result = service.calculateSM2(2.5, 6, 4);

      expect(result.interval).toBeGreaterThan(6);
      expect(result.easeFactor).toBeGreaterThan(2.0);
    });

    it('should set first interval to 6 days on first correct review', () => {
      const result = service.calculateSM2(2.5, 1, 3);

      expect(result.interval).toBe(6);
    });

    it('should enforce minimum ease factor', () => {
      const result = service.calculateSM2(1.3, 1, 0);

      expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
    });

    it('should throw error for invalid quality (<0 or >5)', () => {
      expect(() => service.calculateSM2(2.5, 1, 6)).toThrow();
      expect(() => service.calculateSM2(2.5, 1, -1)).toThrow();
    });
  });

  describe('updateAfterPractice', () => {
    beforeEach(() => {
      skillProgressRepo.findOrCreate.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-1',
        skill: 'vocabulary',
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
        correctCount: 0,
        incorrectCount: 0,
        totalAttempts: 0,
        level: 'beginner',
        confidence: 0.5,
        masteryScore: 0,
        nextReviewAt: new Date(),
        lastReviewAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      skillProgressRepo.updateProgress.mockResolvedValue({} as any);
    });

    it('should update skill progress after successful practice (quality 5)', async () => {
      await service.updateAfterPractice('user-1', 'vocabulary', 5, 95);

      expect(skillProgressRepo.findOrCreate).toHaveBeenCalledWith(
        'user-1',
        'vocabulary',
      );

      expect(skillProgressRepo.updateProgress).toHaveBeenCalledWith(
        'user-1',
        'vocabulary',
        expect.objectContaining({
          correctCount: 1,
          incorrectCount: 0,
          totalAttempts: 1,
          easeFactor: expect.any(Number),
          interval: expect.any(Number),
          nextReviewAt: expect.any(Date),
        }),
      );
    });

    it('should increment incorrect count for failed practice (quality < 3)', async () => {
      await service.updateAfterPractice('user-1', 'vocabulary', 2, 40);

      expect(skillProgressRepo.updateProgress).toHaveBeenCalledWith(
        'user-1',
        'vocabulary',
        expect.objectContaining({
          correctCount: 0,
          incorrectCount: 1,
          totalAttempts: 1,
        }),
      );
    });

    it('should calculate mastery score correctly', async () => {
      await service.updateAfterPractice('user-1', 'vocabulary', 4, 80);

      const updateCall = skillProgressRepo.updateProgress.mock.calls[0][2];
      expect(updateCall.masteryScore).toBeGreaterThan(0);
      expect(updateCall.masteryScore).toBeLessThanOrEqual(100);
    });

    it('should determine correct level from mastery score', async () => {
      skillProgressRepo.findOrCreate.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-1',
        skill: 'vocabulary',
        easeFactor: 2.5,
        interval: 1,
        repetitions: 5,
        correctCount: 18,
        incorrectCount: 2,
        totalAttempts: 20,
        level: 'intermediate',
        confidence: 0.9,
        masteryScore: 85,
        nextReviewAt: new Date(),
        lastReviewAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updateAfterPractice('user-1', 'vocabulary', 5, 95);

      const updateCall = skillProgressRepo.updateProgress.mock.calls[0][2];
      expect(['beginner', 'intermediate', 'advanced']).toContain(
        updateCall.level,
      );
    });
  });

  describe('scoreToQuality', () => {
    it('should convert score to quality correctly', () => {
      expect(service.scoreToQuality(100)).toBe(5); // Perfect
      expect(service.scoreToQuality(95)).toBe(5);
      expect(service.scoreToQuality(85)).toBe(4);
      expect(service.scoreToQuality(70)).toBe(3);
      expect(service.scoreToQuality(50)).toBe(2);
      expect(service.scoreToQuality(30)).toBe(1);
      expect(service.scoreToQuality(10)).toBe(0);
    });
  });

  describe('getDueSkills', () => {
    it('should return skills due for review', async () => {
      const mockDueSkills = [
        {
          id: 'progress-1',
          skill: 'vocabulary',
          nextReviewAt: new Date('2024-01-01'),
        },
        {
          id: 'progress-2',
          skill: 'grammar',
          nextReviewAt: new Date('2024-01-02'),
        },
      ];

      skillProgressRepo.findDueForReview.mockResolvedValue(mockDueSkills as any);

      const result = await service.getDueSkills('user-1', 10);

      expect(result).toEqual(mockDueSkills);
      expect(skillProgressRepo.findDueForReview).toHaveBeenCalledWith(
        'user-1',
        10,
      );
    });
  });

  describe('batchUpdateAfterPractice', () => {
    it('should update multiple skills in batch', async () => {
      skillProgressRepo.findOrCreate.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-1',
        skill: 'vocabulary',
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
        correctCount: 0,
        incorrectCount: 0,
        totalAttempts: 0,
        level: 'beginner',
        confidence: 0.5,
        masteryScore: 0,
        nextReviewAt: new Date(),
        lastReviewAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      skillProgressRepo.updateProgress.mockResolvedValue({} as any);

      const updates = [
        { skill: 'vocabulary', quality: 4, score: 80 },
        { skill: 'grammar', quality: 5, score: 95 },
        { skill: 'listening', quality: 3, score: 65 },
      ];

      await service.batchUpdateAfterPractice('user-1', updates);

      expect(skillProgressRepo.findOrCreate).toHaveBeenCalledTimes(3);
      expect(skillProgressRepo.updateProgress).toHaveBeenCalledTimes(3);
    });
  });
});
