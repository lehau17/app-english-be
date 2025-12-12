import { Test, TestingModule } from '@nestjs/testing';
import { MasteryGateService } from './mastery-gate.service';
import { SkillProgressRepository } from '../repository/skill-progress.repository';

describe('MasteryGateService', () => {
  let service: MasteryGateService;
  let skillProgressRepo: jest.Mocked<SkillProgressRepository>;

  beforeEach(async () => {
    const mockSkillProgressRepo = {
      findByUserIdAndSkill: jest.fn(),
      findByUserId: jest.fn(),
      calculateOverallProgress: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasteryGateService,
        {
          provide: SkillProgressRepository,
          useValue: mockSkillProgressRepo,
        },
      ],
    }).compile();

    service = module.get<MasteryGateService>(MasteryGateService);
    skillProgressRepo = module.get(SkillProgressRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkMastery', () => {
    it('should allow advancement when all skills meet threshold', async () => {
      skillProgressRepo.findByUserIdAndSkill.mockResolvedValue({
        id: 'progress-1',
        masteryScore: 90, // Above 85% threshold
      } as any);

      const result = await service.checkMastery('user-1', ['vocabulary'], 0.85);

      expect(result.canAdvance).toBe(true);
      expect(result.skillsBlocking).toHaveLength(0);
    });

    it('should block advancement when skill is below threshold', async () => {
      skillProgressRepo.findByUserIdAndSkill.mockResolvedValue({
        id: 'progress-1',
        masteryScore: 70, // Below 85% threshold
      } as any);

      const result = await service.checkMastery('user-1', ['vocabulary'], 0.85);

      expect(result.canAdvance).toBe(false);
      expect(result.skillsBlocking).toContain('vocabulary');
      expect(result.skillsProgress).toHaveLength(1);
      expect(result.skillsProgress[0].gap).toBeGreaterThan(0);
    });

    it('should handle missing skill progress (no practice yet)', async () => {
      skillProgressRepo.findByUserIdAndSkill.mockResolvedValue(null);

      const result = await service.checkMastery('user-1', ['vocabulary'], 0.85);

      expect(result.canAdvance).toBe(false);
      expect(result.skillsBlocking).toContain('vocabulary');
      expect(result.skillsProgress[0].currentMastery).toBe(0);
    });

    it('should allow advancement when no skills required', async () => {
      const result = await service.checkMastery('user-1', [], 0.85);

      expect(result.canAdvance).toBe(true);
      expect(result.skillsBlocking).toHaveLength(0);
    });

    it('should check multiple skills correctly', async () => {
      skillProgressRepo.findByUserIdAndSkill
        .mockResolvedValueOnce({ id: '1', masteryScore: 90 } as any) // vocabulary - pass
        .mockResolvedValueOnce({ id: '2', masteryScore: 70 } as any) // grammar - fail
        .mockResolvedValueOnce({ id: '3', masteryScore: 88 } as any); // listening - pass

      const result = await service.checkMastery(
        'user-1',
        ['vocabulary', 'grammar', 'listening'],
        0.85,
      );

      expect(result.canAdvance).toBe(false);
      expect(result.skillsBlocking).toEqual(['grammar']);
      expect(result.skillsProgress).toHaveLength(3);
    });
  });

  describe('getWeakSkills', () => {
    it('should return skills below threshold', async () => {
      skillProgressRepo.findByUserIdAndSkill
        .mockResolvedValueOnce({ id: '1', masteryScore: 50 } as any)
        .mockResolvedValueOnce({ id: '2', masteryScore: 90 } as any)
        .mockResolvedValueOnce({ id: '3', masteryScore: 40 } as any);

      const result = await service.getWeakSkills(
        'user-1',
        ['skill1', 'skill2', 'skill3'],
        0.85,
      );

      expect(result).toHaveLength(2);
      expect(result[0].skill).toBe('skill3'); // Largest gap first
      expect(result[1].skill).toBe('skill1');
    });
  });

  describe('getRemediationPriority', () => {
    it('should prioritize new skills (never practiced)', async () => {
      skillProgressRepo.findByUserIdAndSkill.mockResolvedValue(null);

      const result = await service.getRemediationPriority('user-1', [
        'new-skill',
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].urgency).toBe(100); // Max urgency
      expect(result[0].totalAttempts).toBe(0);
    });

    it('should calculate urgency based on mastery, attempts, and time', async () => {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      skillProgressRepo.findByUserIdAndSkill.mockResolvedValue({
        id: '1',
        masteryScore: 40, // Low mastery
        totalAttempts: 5, // Few attempts
        lastReviewAt: lastWeek, // Not reviewed recently
      } as any);

      const result = await service.getRemediationPriority('user-1', ['skill1']);

      expect(result).toHaveLength(1);
      expect(result[0].urgency).toBeGreaterThan(0);
      expect(result[0].urgency).toBeLessThanOrEqual(100);
    });

    it('should sort by urgency (highest first)', async () => {
      skillProgressRepo.findByUserIdAndSkill
        .mockResolvedValueOnce({
          id: '1',
          masteryScore: 80,
          totalAttempts: 20,
          lastReviewAt: new Date(),
        } as any)
        .mockResolvedValueOnce({
          id: '2',
          masteryScore: 30,
          totalAttempts: 2,
          lastReviewAt: null,
        } as any);

      const result = await service.getRemediationPriority('user-1', [
        'skill1',
        'skill2',
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].urgency).toBeGreaterThan(result[1].urgency);
    });
  });

  describe('checkPrerequisites', () => {
    it('should return met=true when all prerequisites satisfied', async () => {
      skillProgressRepo.findByUserIdAndSkill.mockResolvedValue({
        id: '1',
        masteryScore: 90,
      } as any);

      const result = await service.checkPrerequisites('user-1', [
        { skill: 'vocab', minimumMastery: 85 },
      ]);

      expect(result.met).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should return missing prerequisites', async () => {
      skillProgressRepo.findByUserIdAndSkill.mockResolvedValue({
        id: '1',
        masteryScore: 60,
      } as any);

      const result = await service.checkPrerequisites('user-1', [
        { skill: 'vocab', minimumMastery: 85 },
      ]);

      expect(result.met).toBe(false);
      expect(result.missing).toHaveLength(1);
      expect(result.missing[0].skill).toBe('vocab');
      expect(result.missing[0].current).toBe(60);
      expect(result.missing[0].required).toBe(85);
    });
  });

  describe('getOverallMasteryStatus', () => {
    it('should calculate overall mastery statistics', async () => {
      skillProgressRepo.calculateOverallProgress.mockResolvedValue({
        averageMastery: 75,
        totalSkills: 10,
        masteredSkills: 6,
        weakSkills: 2,
      });

      skillProgressRepo.findByUserId.mockResolvedValue([
        { masteryScore: 50 },
        { masteryScore: 40 },
        { masteryScore: 80 },
        { masteryScore: 90 },
      ] as any);

      const result = await service.getOverallMasteryStatus('user-1');

      expect(result.averageMastery).toBe(75);
      expect(result.totalSkills).toBe(10);
      expect(result.atRiskSkills).toBe(2); // mastery < 60
    });
  });
});
