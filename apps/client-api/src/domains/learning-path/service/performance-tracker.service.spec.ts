import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceTrackerService } from './performance-tracker.service';
import { PrismaRepository } from '@app/database';

describe('PerformanceTrackerService', () => {
  let service: PerformanceTrackerService;
  let prisma: jest.Mocked<PrismaRepository>;

  beforeEach(async () => {
    const mockPrisma = {
      learningPathStep: {
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceTrackerService,
        {
          provide: PrismaRepository,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PerformanceTrackerService>(PerformanceTrackerService);
    prisma = module.get(PrismaRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trackCompletion', () => {
    it('should update step with completion data', async () => {
      prisma.learningPathStep.update.mockResolvedValue({} as any);

      await service.trackCompletion('user-1', 'step-1', {
        score: 85,
        timeSpent: 120,
        success: true,
      });

      expect(prisma.learningPathStep.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: expect.objectContaining({
          score: 85,
          timeSpent: 120,
          status: 'completed',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should mark as in_progress on failure', async () => {
      prisma.learningPathStep.update.mockResolvedValue({} as any);

      await service.trackCompletion('user-1', 'step-1', {
        score: 40,
        timeSpent: 90,
        success: false,
      });

      expect(prisma.learningPathStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'in_progress',
          }),
        }),
      );
    });
  });

  describe('getRecentOverallPerformance', () => {
    it('should calculate success rate and trend', async () => {
      const mockSteps = [
        { id: '1', score: 90, completedAt: new Date() },
        { id: '2', score: 85, completedAt: new Date() },
        { id: '3', score: 70, completedAt: new Date() },
        { id: '4', score: 60, completedAt: new Date() },
        { id: '5', score: 50, completedAt: new Date() },
      ];

      prisma.learningPathStep.findMany.mockResolvedValue(mockSteps as any);

      const result = await service.getRecentOverallPerformance(
        'user-1',
        'path-1',
        5,
      );

      expect(result.averageScore).toBe(71); // (90+85+70+60+50)/5
      expect(result.successRate).toBe(0.6); // 3 out of 5 above 60
      expect(result.trend).toBe('declining'); // Scores decrease over time
    });

    it('should handle empty results', async () => {
      prisma.learningPathStep.findMany.mockResolvedValue([]);

      const result = await service.getRecentOverallPerformance(
        'user-1',
        'path-1',
        5,
      );

      expect(result.averageScore).toBe(0);
      expect(result.successRate).toBe(0);
      expect(result.trend).toBe('stable');
    });
  });

  describe('detectStrugglingPatterns', () => {
    beforeEach(() => {
      prisma.learningPathStep.findMany.mockResolvedValue([
        { id: '1', score: 40, completedAt: new Date() },
        { id: '2', score: 35, completedAt: new Date() },
        { id: '3', score: 30, completedAt: new Date() },
        { id: '4', score: 25, completedAt: new Date() },
        { id: '5', score: 20, completedAt: new Date() },
      ] as any);
    });

    it('should detect struggling patterns', async () => {
      const result = await service.detectStrugglingPatterns('user-1', 'path-1');

      expect(result.isStruggling).toBe(true);
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });
});
