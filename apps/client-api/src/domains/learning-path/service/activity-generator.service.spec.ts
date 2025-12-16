import { GeminiService } from '@app/shared/ai/gemini.service';
import { KafkaProducerService } from '@app/shared/kafka/kafka-producer.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ActivityType, DifficultyLevel } from '@prisma/client';
import { ActivityVariantRepository } from '../repository/activity-variant.repository';
import { ActivityGeneratorService } from './activity-generator.service';
import { ContentValidationService } from './content-validation.service';
import { PromptTemplateService } from './prompt-template.service';

describe('ActivityGeneratorService', () => {
  let service: ActivityGeneratorService;
  let geminiService: GeminiService;
  let promptTemplateService: PromptTemplateService;
  let contentValidationService: ContentValidationService;
  let activityVariantRepository: ActivityVariantRepository;
  let kafkaProducer: KafkaProducerService;

  const mockTemplate = {
    id: 'template-1',
    name: 'VOCAB_B1',
    systemPrompt: 'You are a vocab teacher.',
    userPrompt: 'Generate {{count}} words.',
  };

  const mockGeneratedContent = {
    title: 'Vocabulary: Business Terms',
    description: 'Learn business vocabulary',
    words: [
      {
        word: 'meeting',
        definition: 'a gathering',
        example: 'We have a meeting',
        translation: 'cuộc họp',
      },
    ],
  };

  const mockVariant = {
    id: 'variant-1',
    activityType: 'VOCAB' as ActivityType,
    difficulty: 'MEDIUM' as DifficultyLevel,
    skill: 'business',
    title: 'Vocabulary: Business Terms',
    description: 'Learn business vocabulary',
    content: mockGeneratedContent,
    mediaUrls: [],
    promptTemplateId: 'template-1',
    generationParams: {},
    aiModel: 'gemini-2.5-pro',
    usageCount: 0,
    averageScore: null,
    feedbackCount: 0,
    isApproved: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    baseActivityId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityGeneratorService,
        {
          provide: GeminiService,
          useValue: {
            generateJSONResponse: jest.fn(),
          },
        },
        {
          provide: PromptTemplateService,
          useValue: {
            buildPrompt: jest.fn(),
            incrementUsage: jest.fn(),
          },
        },
        {
          provide: ContentValidationService,
          useValue: {
            validate: jest.fn(),
          },
        },
        {
          provide: ActivityVariantRepository,
          useValue: {
            create: jest.fn(),
            approve: jest.fn(),
            findById: jest.fn(),
            delete: jest.fn(),
            getStatistics: jest.fn(),
          },
        },
        {
          provide: KafkaProducerService,
          useValue: {
            sendMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ActivityGeneratorService>(ActivityGeneratorService);
    geminiService = module.get<GeminiService>(GeminiService);
    promptTemplateService = module.get<PromptTemplateService>(
      PromptTemplateService,
    );
    contentValidationService = module.get<ContentValidationService>(
      ContentValidationService,
    );
    activityVariantRepository = module.get<ActivityVariantRepository>(
      ActivityVariantRepository,
    );
    kafkaProducer = module.get<KafkaProducerService>(KafkaProducerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSync', () => {
    it('should generate activity variant successfully', async () => {
      jest.spyOn(promptTemplateService, 'buildPrompt').mockResolvedValue({
        template: mockTemplate as any,
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt',
      });
      jest
        .spyOn(geminiService, 'generateJSONResponse')
        .mockResolvedValue(JSON.stringify(mockGeneratedContent));
      jest.spyOn(contentValidationService, 'validate').mockResolvedValue({
        isValid: true,
        qualityScore: 92,
        issues: [],
      });
      jest
        .spyOn(activityVariantRepository, 'create')
        .mockResolvedValue(mockVariant);
      jest.spyOn(promptTemplateService, 'incrementUsage').mockResolvedValue();

      const result = await service.generateSync({
        activityType: 'VOCAB',
        difficulty: 'MEDIUM',
        skill: 'business',
        count: 5,
      });

      expect(result.variants).toHaveLength(1);
      expect(result.qualityScore).toBe(92);
      expect(result.promptTemplateId).toBe('template-1');
      expect(promptTemplateService.buildPrompt).toHaveBeenCalled();
      expect(geminiService.generateJSONResponse).toHaveBeenCalled();
      expect(contentValidationService.validate).toHaveBeenCalled();
      expect(activityVariantRepository.create).toHaveBeenCalled();
      expect(promptTemplateService.incrementUsage).toHaveBeenCalledWith(
        'template-1',
      );
    });

    it('should auto-approve high quality variants (score >= 95)', async () => {
      jest.spyOn(promptTemplateService, 'buildPrompt').mockResolvedValue({
        template: mockTemplate as any,
        systemPrompt: 'System',
        userPrompt: 'User',
      });
      jest
        .spyOn(geminiService, 'generateJSONResponse')
        .mockResolvedValue(JSON.stringify(mockGeneratedContent));
      jest.spyOn(contentValidationService, 'validate').mockResolvedValue({
        isValid: true,
        qualityScore: 96,
        issues: [],
      });
      jest
        .spyOn(activityVariantRepository, 'create')
        .mockResolvedValue(mockVariant);
      jest
        .spyOn(activityVariantRepository, 'approve')
        .mockResolvedValue(mockVariant);

      await service.generateSync({
        activityType: 'VOCAB',
        difficulty: 'MEDIUM',
      });

      expect(activityVariantRepository.approve).toHaveBeenCalledWith(
        'variant-1',
      );
    });

    it('should not auto-approve medium quality variants', async () => {
      jest.spyOn(promptTemplateService, 'buildPrompt').mockResolvedValue({
        template: mockTemplate as any,
        systemPrompt: 'System',
        userPrompt: 'User',
      });
      jest
        .spyOn(geminiService, 'generateJSONResponse')
        .mockResolvedValue(JSON.stringify(mockGeneratedContent));
      jest.spyOn(contentValidationService, 'validate').mockResolvedValue({
        isValid: true,
        qualityScore: 85,
        issues: [],
      });
      jest
        .spyOn(activityVariantRepository, 'create')
        .mockResolvedValue(mockVariant);

      await service.generateSync({
        activityType: 'VOCAB',
      });

      expect(activityVariantRepository.approve).not.toHaveBeenCalled();
    });

    it('should store variant even if validation fails', async () => {
      jest.spyOn(promptTemplateService, 'buildPrompt').mockResolvedValue({
        template: mockTemplate as any,
        systemPrompt: 'System',
        userPrompt: 'User',
      });
      jest
        .spyOn(geminiService, 'generateJSONResponse')
        .mockResolvedValue(JSON.stringify(mockGeneratedContent));
      jest.spyOn(contentValidationService, 'validate').mockResolvedValue({
        isValid: false,
        qualityScore: 60,
        issues: ['Missing examples'],
      });
      jest
        .spyOn(activityVariantRepository, 'create')
        .mockResolvedValue(mockVariant);

      const result = await service.generateSync({
        activityType: 'VOCAB',
      });

      expect(result.variants).toHaveLength(1);
      expect(result.qualityScore).toBe(60);
      expect(activityVariantRepository.create).toHaveBeenCalled();
    });

    it('should handle array of activities in generated content', async () => {
      const multiActivityContent = {
        activities: [mockGeneratedContent, mockGeneratedContent],
      };

      jest.spyOn(promptTemplateService, 'buildPrompt').mockResolvedValue({
        template: mockTemplate as any,
        systemPrompt: 'System',
        userPrompt: 'User',
      });
      jest
        .spyOn(geminiService, 'generateJSONResponse')
        .mockResolvedValue(JSON.stringify(multiActivityContent));
      jest.spyOn(contentValidationService, 'validate').mockResolvedValue({
        isValid: true,
        qualityScore: 90,
        issues: [],
      });
      jest
        .spyOn(activityVariantRepository, 'create')
        .mockResolvedValue(mockVariant);

      const result = await service.generateSync({
        activityType: 'VOCAB',
      });

      expect(result.variants).toHaveLength(2);
      expect(activityVariantRepository.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateAsync', () => {
    it('should queue generation job to Kafka', async () => {
      jest.spyOn(kafkaProducer, 'sendMessage').mockResolvedValue(undefined);

      const result = await service.generateAsync({
        activityType: 'VOCAB',
        difficulty: 'MEDIUM',
      });

      expect(result.jobId).toBeDefined();
      expect(result.jobId).toMatch(/^gen-/);
      expect(kafkaProducer.sendMessage).toHaveBeenCalledWith(
        expect.any(String), // ACTIVITY_GENERATION topic
        expect.objectContaining({
          jobId: expect.any(String),
          timestamp: expect.any(String),
          params: expect.objectContaining({
            activityType: 'VOCAB',
          }),
        }),
      );
    });

    it('should throw error if Kafka message fails', async () => {
      jest
        .spyOn(kafkaProducer, 'sendMessage')
        .mockRejectedValue(new Error('Kafka error'));

      await expect(
        service.generateAsync({
          activityType: 'VOCAB',
        }),
      ).rejects.toThrow();
    });
  });

  describe('batchGenerate', () => {
    it('should generate multiple activity types', async () => {
      jest.spyOn(service, 'generateSync').mockResolvedValue({
        variants: [mockVariant],
        qualityScore: 90,
        generationTime: 1000,
        promptTemplateId: 'template-1',
      });

      const result = await service.batchGenerate({
        activityTypes: ['VOCAB', 'QUIZ', 'GRAMMAR'] as ActivityType[],
        difficulty: 'MEDIUM',
      });

      expect(result).toHaveLength(3);
      expect(service.generateSync).toHaveBeenCalledTimes(3);
    });

    it('should continue on individual failures', async () => {
      jest
        .spyOn(service, 'generateSync')
        .mockResolvedValueOnce({
          variants: [mockVariant],
          qualityScore: 90,
          generationTime: 1000,
          promptTemplateId: 'template-1',
        })
        .mockRejectedValueOnce(new Error('Generation failed'))
        .mockResolvedValueOnce({
          variants: [mockVariant],
          qualityScore: 85,
          generationTime: 1200,
          promptTemplateId: 'template-1',
        });

      const result = await service.batchGenerate({
        activityTypes: ['VOCAB', 'QUIZ', 'GRAMMAR'] as ActivityType[],
        difficulty: 'EASY',
      });

      expect(result).toHaveLength(2); // 2 succeeded, 1 failed
    });
  });

  describe('regenerateVariant', () => {
    it('should regenerate existing variant', async () => {
      const existingVariant = {
        ...mockVariant,
        generationParams: {
          activityType: 'VOCAB',
          difficulty: 'MEDIUM',
        },
      };

      jest
        .spyOn(activityVariantRepository, 'findById')
        .mockResolvedValue(existingVariant);
      jest.spyOn(service, 'generateSync').mockResolvedValue({
        variants: [mockVariant],
        qualityScore: 95,
        generationTime: 1000,
        promptTemplateId: 'template-1',
      });
      jest
        .spyOn(activityVariantRepository, 'delete')
        .mockResolvedValue(existingVariant);

      const result = await service.regenerateVariant('variant-1');

      expect(activityVariantRepository.findById).toHaveBeenCalledWith(
        'variant-1',
      );
      expect(service.generateSync).toHaveBeenCalled();
      expect(activityVariantRepository.delete).toHaveBeenCalledWith(
        'variant-1',
      );
      expect(result).toEqual(mockVariant);
    });

    it('should throw error if variant not found', async () => {
      jest.spyOn(activityVariantRepository, 'findById').mockResolvedValue(null);

      await expect(service.regenerateVariant('non-existent')).rejects.toThrow(
        'Variant not found',
      );
    });
  });

  describe('getGenerationStats', () => {
    it('should return generation statistics', async () => {
      jest.spyOn(activityVariantRepository, 'getStatistics').mockResolvedValue({
        total: 100,
        approved: 80,
        byType: { VOCAB: 50, QUIZ: 30, GRAMMAR: 20 },
        byDifficulty: { EASY: 40, MEDIUM: 40, HARD: 20 },
        averageUsage: 5.2,
      });

      const result = await service.getGenerationStats();

      expect(result.totalGenerated).toBe(100);
      expect(result.approvalRate).toBe(0.8);
      expect(result.byType).toEqual({ VOCAB: 50, QUIZ: 30, GRAMMAR: 20 });
    });
  });
});
