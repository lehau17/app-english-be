import { Test, TestingModule } from '@nestjs/testing';
import { ContentValidationService } from './content-validation.service';
import { GeminiService } from '@app/shared/ai/gemini.service';
import { ActivityType } from '@prisma/client';

describe('ContentValidationService', () => {
  let service: ContentValidationService;
  let geminiService: GeminiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentValidationService,
        {
          provide: GeminiService,
          useValue: {
            generateJSONResponse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContentValidationService>(ContentValidationService);
    geminiService = module.get<GeminiService>(GeminiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validate', () => {
    const validVocabContent = {
      title: 'Vocabulary: Business Terms',
      description: 'Learn essential business vocabulary',
      words: [
        {
          word: 'meeting',
          definition: 'a gathering of people',
          example: 'We have a meeting at 3 PM',
          translation: 'cuộc họp',
        },
      ],
    };

    it('should validate content with high quality score', async () => {
      jest.spyOn(geminiService, 'generateJSONResponse').mockResolvedValue(
        JSON.stringify({
          score: 95,
          issues: [],
          strengths: ['Clear definitions', 'Good examples'],
          recommendations: [],
        }),
      );

      const result = await service.validate(validVocabContent, 'VOCAB' as ActivityType, 'B1');

      expect(result.isValid).toBe(true);
      expect(result.qualityScore).toBeGreaterThanOrEqual(90);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing title in rule-based validation', async () => {
      jest.spyOn(geminiService, 'generateJSONResponse').mockResolvedValue(
        JSON.stringify({ score: 80, issues: [] }),
      );

      const invalidContent = {
        ...validVocabContent,
        title: '',
      };

      const result = await service.validate(invalidContent, 'VOCAB' as ActivityType);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Missing or empty title');
    });

    it('should detect missing required fields for VOCAB activity', async () => {
      jest.spyOn(geminiService, 'generateJSONResponse').mockResolvedValue(
        JSON.stringify({ score: 70, issues: [] }),
      );

      const invalidContent = {
        title: 'Test',
        description: 'Test description',
        // Missing words array
      };

      const result = await service.validate(invalidContent, 'VOCAB' as ActivityType);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.includes('words'))).toBe(true);
    });

    it('should detect missing questions for QUIZ activity', async () => {
      jest.spyOn(geminiService, 'generateJSONResponse').mockResolvedValue(
        JSON.stringify({ score: 70, issues: [] }),
      );

      const invalidContent = {
        title: 'Quiz',
        description: 'Test quiz',
        // Missing questions array
      };

      const result = await service.validate(invalidContent, 'QUIZ' as ActivityType);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.includes('questions'))).toBe(true);
    });

    it('should handle LLM validation failure gracefully', async () => {
      jest.spyOn(geminiService, 'generateJSONResponse').mockRejectedValue(
        new Error('API error'),
      );

      const result = await service.validate(validVocabContent, 'VOCAB' as ActivityType);

      // Should fallback to rule-based validation only
      expect(result.qualityScore).toBeLessThan(100);
      expect(result.issues).toBeDefined();
    });

    it('should detect gibberish in title', async () => {
      jest.spyOn(geminiService, 'generateJSONResponse').mockResolvedValue(
        JSON.stringify({ score: 70, issues: [] }),
      );

      const invalidContent = {
        title: '@@@@####!!!!%%%%',
        words: validVocabContent.words,
      };

      const result = await service.validate(invalidContent, 'VOCAB' as ActivityType);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.includes('gibberish'))).toBe(true);
    });

    it('should detect too long title', async () => {
      jest.spyOn(geminiService, 'generateJSONResponse').mockResolvedValue(
        JSON.stringify({ score: 70, issues: [] }),
      );

      const invalidContent = {
        title: 'A'.repeat(201), // 201 characters
        words: validVocabContent.words,
      };

      const result = await service.validate(invalidContent, 'VOCAB' as ActivityType);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.includes('too long'))).toBe(true);
    });

    it('should validate media URLs if present', async () => {
      jest.spyOn(geminiService, 'generateJSONResponse').mockResolvedValue(
        JSON.stringify({ score: 90, issues: [] }),
      );

      const contentWithMedia = {
        ...validVocabContent,
        mediaUrls: ['not-a-valid-url', 'https://valid.com/image.jpg'],
      };

      const result = await service.validate(contentWithMedia, 'VOCAB' as ActivityType);

      expect(result.issues.some(i => i.includes('Invalid URL'))).toBe(true);
    });

    it('should combine LLM and rule-based scores correctly', async () => {
      jest.spyOn(geminiService, 'generateJSONResponse').mockResolvedValue(
        JSON.stringify({ score: 100, issues: [] }),
      );

      const result = await service.validate(validVocabContent, 'VOCAB' as ActivityType);

      // LLM 100 * 0.7 + Rules 100 * 0.3 = 100
      expect(result.llmScore).toBe(100);
      expect(result.ruleScore).toBe(100);
      expect(result.qualityScore).toBe(100);
    });

    it('should validate READING activity requires substantial text', async () => {
      jest.spyOn(geminiService, 'generateJSONResponse').mockResolvedValue(
        JSON.stringify({ score: 80, issues: [] }),
      );

      const invalidReading = {
        title: 'Reading Exercise',
        text: 'Too short', // Less than 50 chars
      };

      const result = await service.validate(invalidReading, 'READING' as ActivityType);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.includes('substantial text'))).toBe(true);
    });

    it('should validate MATCHING activity requires minimum pairs', async () => {
      jest.spyOn(geminiService, 'generateJSONResponse').mockResolvedValue(
        JSON.stringify({ score: 80, issues: [] }),
      );

      const invalidMatching = {
        title: 'Matching Exercise',
        pairs: [
          { left: 'cat', right: 'animal' },
          { left: 'dog', right: 'pet' },
        ], // Only 2 pairs, needs at least 3
      };

      const result = await service.validate(invalidMatching, 'MATCHING' as ActivityType);

      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.includes('at least 3 pairs'))).toBe(true);
    });
  });
});
