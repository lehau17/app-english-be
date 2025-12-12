import { Test, TestingModule } from '@nestjs/testing';
import { PrismaRepository } from '@app/database';
import { SkillProgressRepository } from './skill-progress.repository';
import { SkillProgress } from '@prisma/client';

describe('SkillProgressRepository', () => {
  let repository: SkillProgressRepository;
  let prisma: jest.Mocked<PrismaRepository>;

  const mockUserId = 'user-123';
  const mockSkill = 'vocabulary';

  const mockSkillProgress: SkillProgress = {
    id: 'progress-123',
    userId: mockUserId,
    skill: mockSkill,
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    correctCount: 5,
    incorrectCount: 2,
    totalAttempts: 7,
    level: 'beginner',
    confidence: 0.7,
    masteryScore: 60,
    lastReviewAt: new Date(),
    nextReviewAt: new Date(Date.now() + 86400000), // +1 day
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillProgressRepository,
        {
          provide: PrismaRepository,
          useValue: {
            skillProgress: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<SkillProgressRepository>(SkillProgressRepository);
    prisma = module.get(PrismaRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findOrCreate', () => {
    it('should return existing skill progress', async () => {
      (prisma.skillProgress.findUnique as jest.Mock).mockResolvedValue(
        mockSkillProgress,
      );

      const result = await repository.findOrCreate(mockUserId, mockSkill);

      expect(result).toEqual(mockSkillProgress);
      expect(prisma.skillProgress.findUnique).toHaveBeenCalledWith({
        where: {
          userId_skill: {
            userId: mockUserId,
            skill: mockSkill,
          },
        },
      });
      expect(prisma.skillProgress.create).not.toHaveBeenCalled();
    });

    it('should create new skill progress if not exists', async () => {
      (prisma.skillProgress.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.skillProgress.create as jest.Mock).mockResolvedValue(
        mockSkillProgress,
      );

      const result = await repository.findOrCreate(mockUserId, mockSkill);

      expect(result).toEqual(mockSkillProgress);
      expect(prisma.skillProgress.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          skill: mockSkill,
          nextReviewAt: expect.any(Date),
        },
      });
    });
  });

  describe('updateProgress', () => {
    it('should update skill progress', async () => {
      const updateData = {
        correctCount: 6,
        masteryScore: 70,
        easeFactor: 2.6,
        interval: 2,
        repetitions: 1,
        nextReviewAt: new Date(Date.now() + 172800000), // +2 days
      };

      const updated = {
        ...mockSkillProgress,
        ...updateData,
      };

      (prisma.skillProgress.update as jest.Mock).mockResolvedValue(updated);

      const result = await repository.updateProgress(
        mockUserId,
        mockSkill,
        updateData,
      );

      expect(result).toEqual(updated);
      expect(prisma.skillProgress.update).toHaveBeenCalledWith({
        where: {
          userId_skill: {
            userId: mockUserId,
            skill: mockSkill,
          },
        },
        data: {
          ...updateData,
          lastReviewAt: expect.any(Date),
        },
      });
    });
  });

  describe('findByUserId', () => {
    it('should find all skill progress for user', async () => {
      const skills = [
        mockSkillProgress,
        { ...mockSkillProgress, id: 'progress-456', skill: 'grammar' },
      ];

      (prisma.skillProgress.findMany as jest.Mock).mockResolvedValue(skills);

      const result = await repository.findByUserId(mockUserId);

      expect(result).toEqual(skills);
      expect(prisma.skillProgress.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { masteryScore: 'desc' },
      });
    });
  });

  describe('findByUserIdAndSkill', () => {
    it('should find specific skill progress', async () => {
      (prisma.skillProgress.findUnique as jest.Mock).mockResolvedValue(
        mockSkillProgress,
      );

      const result = await repository.findByUserIdAndSkill(
        mockUserId,
        mockSkill,
      );

      expect(result).toEqual(mockSkillProgress);
    });

    it('should return null if not found', async () => {
      (prisma.skillProgress.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByUserIdAndSkill(
        mockUserId,
        'nonexistent',
      );

      expect(result).toBeNull();
    });
  });

  describe('findDueForReview', () => {
    it('should find skills due for review', async () => {
      const dueSkills = [
        { ...mockSkillProgress, nextReviewAt: new Date(Date.now() - 1000) },
      ];

      (prisma.skillProgress.findMany as jest.Mock).mockResolvedValue(dueSkills);

      const result = await repository.findDueForReview(mockUserId, 10);

      expect(result).toEqual(dueSkills);
      expect(prisma.skillProgress.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          nextReviewAt: {
            lte: expect.any(Date),
          },
        },
        orderBy: {
          nextReviewAt: 'asc',
        },
        take: 10,
      });
    });
  });

  describe('findWeakestSkills', () => {
    it('should find weakest skills', async () => {
      const weakSkills = [
        { ...mockSkillProgress, masteryScore: 40 },
        { ...mockSkillProgress, id: 'progress-456', masteryScore: 50 },
      ];

      (prisma.skillProgress.findMany as jest.Mock).mockResolvedValue(weakSkills);

      const result = await repository.findWeakestSkills(mockUserId, 5);

      expect(result).toEqual(weakSkills);
      expect(prisma.skillProgress.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          masteryScore: {
            lt: 70,
          },
        },
        orderBy: {
          masteryScore: 'asc',
        },
        take: 5,
      });
    });
  });

  describe('findStrongestSkills', () => {
    it('should find strongest skills', async () => {
      const strongSkills = [
        { ...mockSkillProgress, masteryScore: 95 },
        { ...mockSkillProgress, id: 'progress-456', masteryScore: 90 },
      ];

      (prisma.skillProgress.findMany as jest.Mock).mockResolvedValue(
        strongSkills,
      );

      const result = await repository.findStrongestSkills(mockUserId, 5);

      expect(result).toEqual(strongSkills);
      expect(prisma.skillProgress.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
        },
        orderBy: {
          masteryScore: 'desc',
        },
        take: 5,
      });
    });
  });

  describe('calculateOverallProgress', () => {
    it('should calculate overall progress', async () => {
      const skills = [
        { ...mockSkillProgress, masteryScore: 85 },
        { ...mockSkillProgress, id: 'progress-456', masteryScore: 60 },
        { ...mockSkillProgress, id: 'progress-789', masteryScore: 45 },
      ];

      (prisma.skillProgress.findMany as jest.Mock).mockResolvedValue(skills);

      const result = await repository.calculateOverallProgress(mockUserId);

      expect(result).toEqual({
        averageMastery: Math.round((85 + 60 + 45) / 3),
        totalSkills: 3,
        masteredSkills: 1, // >= 80
        weakSkills: 1, // < 50
      });
    });

    it('should handle empty skills array', async () => {
      (prisma.skillProgress.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.calculateOverallProgress(mockUserId);

      expect(result).toEqual({
        averageMastery: 0,
        totalSkills: 0,
        masteredSkills: 0,
        weakSkills: 0,
      });
    });
  });

  describe('delete', () => {
    it('should delete skill progress', async () => {
      (prisma.skillProgress.delete as jest.Mock).mockResolvedValue(
        mockSkillProgress,
      );

      const result = await repository.delete(mockUserId, mockSkill);

      expect(result).toEqual(mockSkillProgress);
      expect(prisma.skillProgress.delete).toHaveBeenCalledWith({
        where: {
          userId_skill: {
            userId: mockUserId,
            skill: mockSkill,
          },
        },
      });
    });
  });
});
