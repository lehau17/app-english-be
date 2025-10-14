import { Test, TestingModule } from '@nestjs/testing';
import { LearningPathService } from '../learning-path.service';
import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared/ai/gemini.service';
import { ActivityType, DifficultyLevel, Progress } from '@prisma/client';

// Mock data
const mockUserId = 'user-123';
const mockProgressData: Partial<Progress>[] = [
  { userId: mockUserId, score: 50, activity: { type: ActivityType.listening } },
  { userId: mockUserId, score: 60, activity: { type: ActivityType.listening } },
  { userId: mockUserId, score: 90, activity: { type: ActivityType.grammar } },
  { userId: mockUserId, score: 85, activity: { type: ActivityType.grammar } },
  { userId: mockUserId, score: 40, activity: { type: ActivityType.speaking } },
];

const mockGeminiResponse = JSON.stringify({
  learningSteps: [
    { title: 'Cải thiện kỹ năng nghe', focusArea: 'listening' },
    { title: 'Thực hành phát âm', focusArea: 'speaking' },
  ],
});

const mockLearningPath = {
  id: 'lp-123',
  userId: mockUserId,
  name: 'Lộ trình học tập cá nhân hóa',
  targetLevel: DifficultyLevel.intermediate,
  focusAreas: ['listening', 'speaking'],
  customContent: { steps: [] },
  currentStep: 0,
  isCompleted: false,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('LearningPathService', () => {
  let service: LearningPathService;
  let prisma: PrismaRepository;
  let geminiService: GeminiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningPathService,
        {
          provide: PrismaRepository,
          useValue: {
            progress: {
              findMany: jest.fn(),
            },
            learningPath: {
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: GeminiService,
          useValue: {
            generateResponse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LearningPathService>(LearningPathService);
    prisma = module.get<PrismaRepository>(PrismaRepository);
    geminiService = module.get<GeminiService>(GeminiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateDynamicLearningPath', () => {
    it('should generate a learning path successfully', async () => {
      // Arrange
      jest.spyOn(prisma.progress, 'findMany').mockResolvedValue(mockProgressData as any);
      jest.spyOn(geminiService, 'generateResponse').mockResolvedValue(mockGeminiResponse);
      jest.spyOn(prisma.learningPath, 'upsert').mockResolvedValue(mockLearningPath);

      // Act
      const result = await service.generateDynamicLearningPath(mockUserId);

      // Assert
      expect(result).toEqual(mockLearningPath);
      expect(prisma.progress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId, score: { not: null } },
        }),
      );
      expect(geminiService.generateResponse).toHaveBeenCalled();
      expect(prisma.learningPath.upsert).toHaveBeenCalled();
    });

    it('should return null if there is not enough performance data', async () => {
      // Arrange
      jest.spyOn(prisma.progress, 'findMany').mockResolvedValue([]);

      // Act
      const result = await service.generateDynamicLearningPath(mockUserId);

      // Assert
      expect(result).toBeNull();
      expect(geminiService.generateResponse).not.toHaveBeenCalled();
    });

    it('should throw an error if Gemini returns invalid JSON', async () => {
      // Arrange
      jest.spyOn(prisma.progress, 'findMany').mockResolvedValue(mockProgressData as any);
      jest.spyOn(geminiService, 'generateResponse').mockResolvedValue('this is not json');

      // Act & Assert
      await expect(service.generateDynamicLearningPath(mockUserId)).rejects.toThrow(
        'Không thể tạo lộ trình học tập từ phản hồi của AI.',
      );
    });
  });
});