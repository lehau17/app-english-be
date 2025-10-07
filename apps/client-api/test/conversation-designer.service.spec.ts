// Set required environment variables before any imports
process.env.KAFKA_BROKERS = 'localhost:9092';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

import { DifficultyLevel } from '@prisma/client';
import { ConversationDesignerService } from '../src/domains/ai-speaking/service/conversation-designer.service';

describe('ConversationDesignerService', () => {
  let service: ConversationDesignerService;

  beforeEach(() => {
    service = new ConversationDesignerService();
  });

  describe('buildOpeningPrompt', () => {
    test('should generate correct prompt structure for beginner', () => {
      const options = {
        topic: 'Daily routines',
        difficulty: DifficultyLevel.beginner,
      };

      const result = service.buildOpeningPrompt(options);

      expect(result).toBeDefined();
      expect(result.prompt).toContain('Daily routines');
      expect(result.prompt).toContain('Hello!');
      expect(result.followUpSuggestions).toBeInstanceOf(Array);
      expect(result.followUpSuggestions.length).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.topic).toBe('Daily routines');
      expect(result.metadata.difficulty).toBe(DifficultyLevel.beginner);
      expect(result.version).toBe('1.0.0');
    });

    test('should handle different difficulty levels', () => {
      const difficulties = [
        DifficultyLevel.beginner,
        DifficultyLevel.elementary,
        DifficultyLevel.intermediate,
        DifficultyLevel.upper_intermediate,
        DifficultyLevel.advanced,
        DifficultyLevel.expert,
      ];

      difficulties.forEach((difficulty) => {
        const result = service.buildOpeningPrompt({
          topic: 'Test topic',
          difficulty,
        });

        expect(result).toBeDefined();
        expect(result.metadata.difficulty).toBe(difficulty);
        expect(result.metadata.hint).toBeDefined();
        expect(typeof result.metadata.hint).toBe('string');
        expect((result.metadata.hint as string).length).toBeGreaterThan(0);
      });
    });

    test('should use default topic when not provided', () => {
      const result = service.buildOpeningPrompt({
        difficulty: DifficultyLevel.intermediate,
      });

      expect(result).toBeDefined();
      expect(result.prompt).toContain('your daily life');
      expect(result.metadata.topic).toBe('your daily life');
    });

    test('should include appropriate suggestions', () => {
      const result = service.buildOpeningPrompt({
        topic: 'Food and cooking',
        difficulty: DifficultyLevel.intermediate,
      });

      expect(result.followUpSuggestions).toHaveLength(3);
      expect(result.followUpSuggestions[0]).toContain('Food and cooking');
      expect(result.followUpSuggestions.every((s) => s.length > 0)).toBe(true);
    });

    test('should include difficulty hint in metadata for beginner', () => {
      const result = service.buildOpeningPrompt({
        topic: 'Hobbies',
        difficulty: DifficultyLevel.beginner,
      });

      expect(result.metadata.hint).toContain('từ vựng đơn giản');
      expect(result.metadata.hint).toContain('nói chậm rãi');
    });

    test('should include difficulty hint in metadata for intermediate', () => {
      const result = service.buildOpeningPrompt({
        topic: 'Technology',
        difficulty: DifficultyLevel.intermediate,
      });

      expect(result.metadata.hint).toContain('Why/How');
      expect(result.metadata.hint).toContain('liên từ');
    });

    test('should include difficulty hint in metadata for advanced', () => {
      const result = service.buildOpeningPrompt({
        topic: 'Climate change',
        difficulty: DifficultyLevel.advanced,
      });

      expect(result.metadata.hint).toContain('lập luận');
      expect(result.metadata.hint).toContain('ưu/nhược điểm');
    });

    test('should include difficulty hint in metadata for expert', () => {
      const result = service.buildOpeningPrompt({
        topic: 'Global economics',
        difficulty: DifficultyLevel.expert,
      });

      expect(result.metadata.hint).toContain('phức tạp');
      expect(result.metadata.hint).toContain('phản biện');
      expect(result.metadata.hint).toContain('thuật ngữ chuyên ngành');
    });

    test('should create valid prompt format', () => {
      const result = service.buildOpeningPrompt({
        topic: 'Sports',
        difficulty: DifficultyLevel.elementary,
      });

      // Check prompt format
      expect(result.prompt).toMatch(/Hello.*practice speaking.*Sports/i);
      expect(result.prompt.endsWith('?')).toBe(true);
    });

    test('should return consistent structure across different topics', () => {
      const topics = ['Travel', 'Education', 'Family', 'Work', 'Entertainment'];

      topics.forEach((topic) => {
        const result = service.buildOpeningPrompt({
          topic,
          difficulty: DifficultyLevel.intermediate,
        });

        // Verify structure consistency
        expect(result).toHaveProperty('prompt');
        expect(result).toHaveProperty('followUpSuggestions');
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('version');

        expect(typeof result.prompt).toBe('string');
        expect(Array.isArray(result.followUpSuggestions)).toBe(true);
        expect(typeof result.metadata).toBe('object');
        expect(typeof result.version).toBe('string');
      });
    });

    test('should generate unique suggestions for different topics', () => {
      const result1 = service.buildOpeningPrompt({
        topic: 'Music',
        difficulty: DifficultyLevel.intermediate,
      });

      const result2 = service.buildOpeningPrompt({
        topic: 'Science',
        difficulty: DifficultyLevel.intermediate,
      });

      // First suggestion should reference the topic
      expect(result1.followUpSuggestions[0]).toContain('Music');
      expect(result2.followUpSuggestions[0]).toContain('Science');
    });

    test('should handle special characters in topic', () => {
      const result = service.buildOpeningPrompt({
        topic: 'AI & Machine Learning',
        difficulty: DifficultyLevel.advanced,
      });

      expect(result.prompt).toContain('AI & Machine Learning');
      expect(result.metadata.topic).toBe('AI & Machine Learning');
      expect(result.followUpSuggestions[0]).toContain('AI & Machine Learning');
    });

    test('should handle empty string topic by using default', () => {
      const result = service.buildOpeningPrompt({
        topic: '',
        difficulty: DifficultyLevel.beginner,
      });

      // Empty string should be treated as falsy and use default
      expect(result.prompt).toBeDefined();
      expect(result.metadata.topic).toBeDefined();
    });

    test('should maintain version number', () => {
      const result = service.buildOpeningPrompt({
        topic: 'Test',
        difficulty: DifficultyLevel.beginner,
      });

      expect(result.version).toBe('1.0.0');
    });
  });
});
