import { PrismaRepository } from '@app/database';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ActivityType, DifficultyLevel } from '@prisma/client';
import { PromptTemplateService } from './prompt-template.service';

describe('PromptTemplateService', () => {
  let service: PromptTemplateService;
  let prisma: PrismaRepository;

  const mockTemplate = {
    id: 'template-1',
    name: 'VOCAB_A1_General',
    description: 'Basic vocabulary',
    activityType: 'VOCAB' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: 'You are a teacher creating {{activityType}} exercises.',
    userPrompt: 'Generate {{count}} words for {{proficiencyLevel}} level.',
    modelName: 'gemini-2.0-flash',
    temperature: 0.7,
    maxTokens: 2048,
    parameters: null,
    version: 1,
    isActive: true,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptTemplateService,
        {
          provide: PrismaRepository,
          useValue: {
            promptTemplate: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PromptTemplateService>(PromptTemplateService);
    prisma = module.get<PrismaRepository>(PrismaRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findTemplate', () => {
    it('should find exact match template', async () => {
      jest
        .spyOn(prisma.promptTemplate, 'findFirst')
        .mockResolvedValue(mockTemplate);

      const result = await service.findTemplate({
        activityType: 'VOCAB',
        difficulty: 'EASY',
        skill: null,
      });

      expect(result).toEqual(mockTemplate);
      expect(prisma.promptTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          activityType: 'VOCAB',
          difficulty: 'EASY',
          skill: null,
        },
      });
    });

    it('should fallback to type-only match if exact match not found', async () => {
      jest
        .spyOn(prisma.promptTemplate, 'findFirst')
        .mockResolvedValueOnce(null) // First call (exact match) fails
        .mockResolvedValueOnce(mockTemplate); // Second call (type only) succeeds

      const result = await service.findTemplate({
        activityType: 'VOCAB',
        difficulty: 'EASY',
        skill: 'business',
      });

      expect(result).toEqual(mockTemplate);
      expect(prisma.promptTemplate.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('selectBestTemplate', () => {
    it('should select exact match template (priority 1)', async () => {
      jest
        .spyOn(prisma.promptTemplate, 'findFirst')
        .mockResolvedValue(mockTemplate);

      const result = await service.selectBestTemplate({
        activityType: 'VOCAB',
        difficulty: 'EASY',
        skill: 'business',
      });

      expect(result).toEqual(mockTemplate);
    });

    it('should select type+difficulty template (priority 2)', async () => {
      jest
        .spyOn(prisma.promptTemplate, 'findFirst')
        .mockResolvedValueOnce(null) // Priority 1 fails
        .mockResolvedValueOnce(mockTemplate); // Priority 2 succeeds

      const result = await service.selectBestTemplate({
        activityType: 'VOCAB',
        difficulty: 'EASY',
        skill: 'business',
      });

      expect(result).toEqual(mockTemplate);
    });

    it('should throw NotFoundException if no template found', async () => {
      jest.spyOn(prisma.promptTemplate, 'findFirst').mockResolvedValue(null);

      await expect(
        service.selectBestTemplate({
          activityType: 'VOCAB',
          difficulty: 'EASY',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('substituteVariables', () => {
    it('should substitute variables in template', () => {
      const template = 'Hello {{name}}, you are {{age}} years old.';
      const variables = { name: 'John', age: 25 };

      const result = service.substituteVariables(template, variables);

      expect(result).toBe('Hello John, you are 25 years old.');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{name}}, you are {{age}} years old.';
      const variables = { name: 'John' };

      const result = service.substituteVariables(template, variables);

      expect(result).toBe('Hello John, you are  years old.');
    });

    it('should replace all occurrences of variable', () => {
      const template = '{{word}} is a {{word}}.';
      const variables = { word: 'cat' };

      const result = service.substituteVariables(template, variables);

      expect(result).toBe('cat is a cat.');
    });
  });

  describe('buildPrompt', () => {
    it('should build complete prompt with variables', async () => {
      jest
        .spyOn(prisma.promptTemplate, 'findFirst')
        .mockResolvedValue(mockTemplate);

      const result = await service.buildPrompt({
        activityType: 'VOCAB',
        difficulty: 'EASY',
        skill: 'business',
        variables: { count: 10 },
      });

      expect(result.template).toEqual(mockTemplate);
      expect(result.systemPrompt).toContain('VOCAB');
      expect(result.userPrompt).toContain('10');
      expect(result.userPrompt).toContain('B1'); // Default proficiency level
    });

    it('should include default variables', async () => {
      jest
        .spyOn(prisma.promptTemplate, 'findFirst')
        .mockResolvedValue(mockTemplate);

      const result = await service.buildPrompt({
        activityType: 'VOCAB',
      });

      expect(result.systemPrompt).toBeDefined();
      expect(result.userPrompt).toBeDefined();
    });
  });

  describe('incrementUsage', () => {
    it('should increment template usage count', async () => {
      jest.spyOn(prisma.promptTemplate, 'update').mockResolvedValue({
        ...mockTemplate,
        usageCount: 1,
      });

      await service.incrementUsage('template-1');

      expect(prisma.promptTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: {
          usageCount: {
            increment: 1,
          },
        },
      });
    });
  });

  describe('listTemplates', () => {
    it('should list all templates without filters', async () => {
      jest
        .spyOn(prisma.promptTemplate, 'findMany')
        .mockResolvedValue([mockTemplate]);

      const result = await service.listTemplates();

      expect(result).toEqual([mockTemplate]);
      expect(prisma.promptTemplate.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ activityType: 'asc' }, { difficulty: 'asc' }],
      });
    });

    it('should filter templates by activity type', async () => {
      jest
        .spyOn(prisma.promptTemplate, 'findMany')
        .mockResolvedValue([mockTemplate]);

      const result = await service.listTemplates({ activityType: 'VOCAB' });

      expect(result).toEqual([mockTemplate]);
      expect(prisma.promptTemplate.findMany).toHaveBeenCalledWith({
        where: { activityType: 'VOCAB' },
        orderBy: [{ activityType: 'asc' }, { difficulty: 'asc' }],
      });
    });
  });
});
