import { GeminiService } from '@app/shared';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { RagService } from '../service/rag.service';

@Injectable()
export class GrammarExplainerTool {
  private readonly logger = new Logger(GrammarExplainerTool.name);

  constructor(
    private gemini: GeminiService,
    private rag: RagService,
  ) {}

  getTool() {
    return new DynamicStructuredTool({
      name: 'grammar_explainer',
      description:
        'Giải thích quy tắc ngữ pháp tiếng Anh. Cung cấp cấu trúc, cách dùng, ví dụ, lỗi thường gặp. ' +
        'Sử dụng khi học sinh hỏi: "Khi nào dùng present perfect?", "Sự khác biệt giữa A và B", ' +
        '"Giải thích về mệnh đề quan hệ", "Cách dùng to infinitive"',
      schema: z.object({
        topic: z
          .string()
          .describe(
            'Chủ đề ngữ pháp cần giải thích (vd: "present perfect", "relative clauses")',
          ),
        includeExamples: z
          .boolean()
          .optional()
          .default(true)
          .describe('Có bao gồm ví dụ không'),
        includeCommonMistakes: z
          .boolean()
          .optional()
          .default(true)
          .describe('Có bao gồm lỗi thường gặp không'),
        difficulty: z
          .enum(['beginner', 'intermediate', 'advanced'])
          .optional()
          .default('intermediate')
          .describe('Độ khó của giải thích'),
      }),
      func: async ({ topic, includeExamples, includeCommonMistakes, difficulty }) => {
        try {
          this.logger.log(`📖 Explaining grammar topic: "${topic}" (${difficulty})`);

          // 1. Search RAG for related lessons
          let relatedLessons = [];
          try {
            const ragResults = await this.rag.searchKnowledge(
              `grammar ${topic} lesson explanation`,
              {
                useExpansion: false,
                useCache: true,
                useReranking: false,
              },
            );

            if (ragResults.sources.length > 0) {
              relatedLessons = ragResults.sources.slice(0, 3).map((s) => ({
                id: s.id || null,
                title: s.title,
                type: s.type,
                score: s.finalScore,
              }));
            }
          } catch (ragError) {
            this.logger.warn(`RAG search failed: ${ragError.message}`);
          }

          // 2. Generate comprehensive explanation with Gemini
          const prompt = `
You are an expert English grammar teacher explaining to a ${difficulty} level student.

Topic: ${topic}

Provide a comprehensive explanation including:

1. **Grammar Rule/Structure**: Clear explanation of the grammar pattern
2. **When to Use**: Situations and contexts where this grammar is used
${includeExamples ? '3. **Examples**: 4-6 example sentences with Vietnamese translations' : ''}
${includeCommonMistakes ? '4. **Common Mistakes**: 3-4 common errors students make with corrections' : ''}
5. **Key Points**: 2-3 important things to remember
6. **Practice Tips**: How to practice and master this grammar

Format as JSON:
{
  "topic": "${topic}",
  "structure": "...",
  "usage": ["point 1", "point 2", "point 3"],
  ${includeExamples ? '"examples": [{"sentence": "...", "explanation": "...", "vi": "..."}],' : ''}
  ${includeCommonMistakes ? '"commonMistakes": [{"wrong": "...", "correct": "...", "reason": "..."}],' : ''}
  "keyPoints": ["...", "..."],
  "practiceTips": ["...", "..."],
  "difficulty": "${difficulty}"
}

Make explanations clear, simple, and easy to understand. Use Vietnamese when helpful.
`;

          const response = await this.gemini.generateResponse(prompt);

          // 3. Parse response
          let explanation: any;
          try {
            const cleaned = response
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            explanation = JSON.parse(cleaned);
          } catch (parseError) {
            this.logger.warn('Failed to parse Gemini response, using raw text');
            explanation = {
              topic,
              structure: response,
              difficulty,
              parseError: true,
            };
          }

          // 4. Generate practice exercises
          let practiceExercises = [];
          try {
            const practicePrompt = `
Create 3 practice exercises for the grammar topic: "${topic}" (${difficulty} level)

Types: multiple choice, fill-in-blank, error correction

Format as JSON array:
[
  {
    "type": "multiple-choice",
    "question": "Choose the correct answer: I ___ (see) this movie before.",
    "options": ["saw", "have seen", "see", "seeing"],
    "correctAnswer": "have seen",
    "explanation": "Present perfect for past experience"
  },
  {
    "type": "fill-blank",
    "question": "She ___ (live) in Paris for 5 years.",
    "answer": "has lived",
    "explanation": "Present perfect for duration continuing to present"
  },
  {
    "type": "error-correction",
    "question": "I have seen him yesterday.",
    "correctAnswer": "I saw him yesterday.",
    "explanation": "Present perfect cannot be used with specific past time"
  }
]
`;

            const practiceResponse = await this.gemini.generateResponse(
              practicePrompt,
            );

            try {
              const cleaned = practiceResponse
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
              practiceExercises = JSON.parse(cleaned);
            } catch (e) {
              this.logger.warn('Failed to parse practice exercises');
            }
          } catch (practiceError) {
            this.logger.warn(
              `Practice generation failed: ${practiceError.message}`,
            );
          }

          // 5. Compile final result
          const result = {
            ...explanation,
            relatedLessons,
            practiceExercises,
            generatedAt: new Date().toISOString(),
          };

          this.logger.log(`✅ Grammar explanation complete for "${topic}"`);

          return JSON.stringify({
            success: true,
            data: result,
          });
        } catch (error) {
          this.logger.error(`❌ Grammar explainer error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: error.message,
            topic,
          });
        }
      },
    });
  }
}
