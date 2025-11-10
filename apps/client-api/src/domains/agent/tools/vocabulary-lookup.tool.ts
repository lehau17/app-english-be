import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { RagService } from '../service/rag.service';

@Injectable()
export class VocabularyLookupTool {
  private readonly logger = new Logger(VocabularyLookupTool.name);

  constructor(
    private prisma: PrismaRepository,
    private gemini: GeminiService,
    private rag: RagService,
  ) {}

  getTool() {
    return new DynamicStructuredTool({
      name: 'vocabulary_lookup',
      description:
        'Tra từ vựng thông minh. Tìm nghĩa, phát âm, ví dụ, từ đồng nghĩa, bài tập luyện tập. ' +
        'Sử dụng khi học sinh hỏi: "Nghĩa của từ X là gì?", "Cho tôi ví dụ về từ Y", "Từ đồng nghĩa với Z"',
      schema: z.object({
        word: z.string().describe('Từ cần tra'),
        includeSynonyms: z
          .boolean()
          .optional()
          .default(true)
          .describe('Có bao gồm từ đồng nghĩa không'),
        includeExamples: z
          .boolean()
          .optional()
          .default(true)
          .describe('Có bao gồm ví dụ không'),
        includePractice: z
          .boolean()
          .optional()
          .default(true)
          .describe('Có tạo câu hỏi luyện tập không'),
      }),
      func: async ({
        word,
        includeSynonyms,
        includeExamples,
        includePractice,
      }) => {
        try {
          this.logger.log(`📚 Looking up word: "${word}"`);

          // 1. Search in database first
          const dbResults = await this.prisma.vocabularyTerm.findMany({
            where: {
              word: {
                equals: word,
                mode: 'insensitive',
              },
            },
            include: {
              unit: {
                include: {
                  list: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
            take: 3,
          });

          let result: any = {
            word: word.toLowerCase(),
            foundInDatabase: dbResults.length > 0,
          };

          // 2. Use database data if available
          if (dbResults.length > 0) {
            const primary = dbResults[0];

            result = {
              ...result,
              definitions: [
                {
                  type: primary.partOfSpeech || 'unknown',
                  meaning: primary.definition,
                  viMeaning: primary.translationVi || null,
                  example: primary.examples
                    ? (primary.examples as any[])[0]?.sentence
                    : null,
                  viExample: primary.examples
                    ? (primary.examples as any[])[0]?.translation
                    : null,
                },
              ],
              pronunciation: {
                us: primary.ipaUs || primary.pronunciation || null,
                uk: primary.ipaUk || null,
                audioUrl: primary.audioUrl || null,
              },
              synonyms: includeSynonyms ? primary.synonyms : [],
              antonyms: primary.antonyms || [],
              imageUrl: primary.imageUrl || null,
              relatedLessons: dbResults.map((r) => ({
                listId: r.unit.list.id,
                listTitle: r.unit.list.title,
                unitTitle: r.unit.title,
              })),
              difficulty: primary.difficulty,
            };
          } else {
            // 3. If not in DB, use Gemini to generate definition
            this.logger.log(`🤖 Word not in DB, using Gemini...`);

            const prompt = `
You are an English dictionary and learning assistant.

Task: Define the word "${word}" in detail for English learners.

Provide:
1. Part of speech (noun/verb/adjective/etc)
2. Definition in English (clear and simple)
3. Vietnamese translation
4. IPA pronunciation (US and UK if different)
${includeExamples ? '5. 2-3 example sentences with Vietnamese translations' : ''}
${includeSynonyms ? '6. 2-3 synonyms and antonyms' : ''}
7. Difficulty level (beginner/intermediate/advanced)

Format as JSON:
{
  "definitions": [
    {
      "type": "noun",
      "meaning": "...",
      "viMeaning": "...",
      "example": "...",
      "viExample": "..."
    }
  ],
  "pronunciation": {
    "us": "/..../",
    "uk": "/...."
  },
  "synonyms": ["...", "..."],
  "antonyms": ["...", "..."],
  "difficulty": "intermediate"
}
`;

            const response = await this.gemini.generateResponse(prompt);

            // Try to parse JSON response
            try {
              const cleaned = response
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
              const generated = JSON.parse(cleaned);

              result = {
                ...result,
                ...generated,
                generatedByAI: true,
              };
            } catch (parseError) {
              // Fallback: return raw response
              result = {
                ...result,
                definitions: [
                  {
                    type: 'unknown',
                    meaning: response,
                    viMeaning: null,
                  },
                ],
                generatedByAI: true,
                parseError: true,
              };
            }
          }

          // 4. Search RAG for related lessons/activities
          try {
            const ragResults = await this.rag.searchKnowledge(
              `vocabulary word "${word}" lessons activities`,
              {
                useExpansion: false,
                useCache: true,
                useReranking: false,
              },
            );

            if (ragResults.sources.length > 0) {
              result.ragSuggestions = ragResults.sources
                .slice(0, 3)
                .map((s) => ({
                  title: s.title,
                  type: s.type,
                  score: s.finalScore,
                }));
            }
          } catch (ragError) {
            this.logger.warn(`RAG search failed: ${ragError.message}`);
          }

          // 5. Generate practice questions if requested
          if (includePractice) {
            try {
              const practicePrompt = `
Create 2 practice questions for the word "${word}".

Question types:
1. Fill in the blank
2. Multiple choice

Format as JSON array:
[
  {
    "type": "fill-blank",
    "question": "She is a successful _____.",
    "answer": "${word}"
  },
  {
    "type": "multiple-choice",
    "question": "What does '${word}' mean?",
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": "option1"
  }
]
`;

              const practiceResponse =
                await this.gemini.generateResponse(practicePrompt);

              try {
                const cleaned = practiceResponse
                  .replace(/```json\n?/g, '')
                  .replace(/```\n?/g, '')
                  .trim();
                result.practiceQuestions = JSON.parse(cleaned);
              } catch (e) {
                this.logger.warn('Failed to parse practice questions');
              }
            } catch (practiceError) {
              this.logger.warn(
                `Practice generation failed: ${practiceError.message}`,
              );
            }
          }

          // 6. Check if user has saved this word
          result.inUserList = false;
          result.masteryLevel = null;

          this.logger.log(`✅ Lookup complete for "${word}"`);

          return JSON.stringify({
            success: true,
            data: result,
          });
        } catch (error) {
          this.logger.error(`❌ Vocabulary lookup error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: error.message,
            word,
          });
        }
      },
    });
  }
}
