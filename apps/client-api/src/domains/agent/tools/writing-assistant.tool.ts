import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * WritingAssistantTool - Cong cu cham va sua bai viet tieng Anh
 *
 * Features:
 * - Cham diem theo tieu chi IELTS/TOEFL/General
 * - Sua loi ngu phap, tu vung, chinh ta
 * - Goi y cai thien cau truc, coherence
 * - Phan tich diem manh/yeu
 * - Viet lai doan van mau
 * - Track writing progress over time
 */
@Injectable()
export class WritingAssistantTool {
  private readonly logger = new Logger(WritingAssistantTool.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly gemini: GeminiService,
  ) {}

  /**
   * Get all writing assistant tools
   */
  getTools(): DynamicStructuredTool[] {
    return [
      this.getEssayGraderTool(),
      this.getGrammarCheckerTool(),
      this.getWritingImproverTool(),
      this.getWritingPromptTool(),
      this.getWritingHistoryTool(),
    ];
  }

  /**
   * Tool 1: Cham diem bai viet theo tieu chi
   */
  private getEssayGraderTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'grade_essay',
      description: `Cham diem bai viet tieng Anh theo tieu chi IELTS/TOEFL/General. Su dung khi:
- "cham bai viet", "grade my essay", "diem bai nay bao nhieu"
- "danh gia bai luan", "review my writing"
- Hoc sinh gui bai viet can cham diem
Tra ve diem so chi tiet, nhan xet va goi y cai thien.`,
      schema: z.object({
        userId: z.string().describe('ID cua hoc sinh'),
        essay: z
          .string()
          .min(50)
          .describe('Noi dung bai viet (toi thieu 50 ky tu)'),
        essayType: z
          .enum(['essay', 'paragraph', 'letter', 'email', 'report', 'story'])
          .optional()
          .default('essay')
          .describe('Loai bai viet'),
        gradingScale: z
          .enum(['ielts', 'toefl', 'general', 'cefr'])
          .optional()
          .default('general')
          .describe('Thang diem su dung'),
        topic: z.string().optional().describe('De bai/chu de (neu co)'),
        wordLimit: z.number().optional().describe('Gioi han so tu (neu co)'),
      }),
      func: async ({
        userId,
        essay,
        essayType = 'essay',
        gradingScale = 'general',
        topic,
        wordLimit,
      }) => {
        try {
          this.logger.log(
            `Grading ${essayType} for user ${userId}, scale: ${gradingScale}`,
          );

          const wordCount = essay.split(/\s+/).filter(Boolean).length;
          const sentenceCount = essay.split(/[.!?]+/).filter(Boolean).length;
          const paragraphCount = essay.split(/\n\n+/).filter(Boolean).length;

          // Build grading prompt based on scale
          const gradingCriteria = this.getGradingCriteria(gradingScale);

          const prompt = `
You are an expert English writing assessor. Grade the following ${essayType} according to ${gradingScale.toUpperCase()} criteria.

${topic ? `TOPIC/PROMPT: ${topic}` : ''}
${wordLimit ? `WORD LIMIT: ${wordLimit} words` : ''}

ESSAY TO GRADE:
"""
${essay}
"""

WORD COUNT: ${wordCount} words
SENTENCES: ${sentenceCount}
PARAGRAPHS: ${paragraphCount}

GRADING CRITERIA (${gradingScale.toUpperCase()}):
${gradingCriteria}

Provide detailed assessment in JSON format:
{
  "overallScore": <number 0-100 for general, 0-9 for IELTS, 0-30 for TOEFL>,
  "bandScore": "<for IELTS: 4.0-9.0, for TOEFL: 0-30, for general: A-F>",
  "criteriaScores": {
    "taskAchievement": {
      "score": <number>,
      "maxScore": <number>,
      "feedback": "<specific feedback>"
    },
    "coherenceAndCohesion": {
      "score": <number>,
      "maxScore": <number>,
      "feedback": "<specific feedback>"
    },
    "lexicalResource": {
      "score": <number>,
      "maxScore": <number>,
      "feedback": "<specific feedback>"
    },
    "grammaticalRange": {
      "score": <number>,
      "maxScore": <number>,
      "feedback": "<specific feedback>"
    }
  },
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "grammarErrors": [
    {
      "original": "<error text>",
      "correction": "<corrected text>",
      "explanation": "<why it's wrong>",
      "type": "<grammar/spelling/punctuation/word choice>"
    }
  ],
  "vocabularyFeedback": {
    "level": "<basic/intermediate/advanced>",
    "highlights": ["<good word usage>"],
    "suggestions": ["<better word alternatives>"]
  },
  "structureFeedback": {
    "hasIntro": <boolean>,
    "hasConclusion": <boolean>,
    "paragraphOrganization": "<feedback>",
    "transitionWords": "<feedback>"
  },
  "improvementTips": ["<tip 1>", "<tip 2>", "<tip 3>"],
  "rewrittenSample": "<optional: rewrite one weak paragraph as example>",
  "estimatedCEFRLevel": "<A1/A2/B1/B2/C1/C2>"
}

Be constructive and encouraging while being accurate. Use Vietnamese for feedback messages.
`;

          const response = await this.gemini.generateResponse(prompt);

          let grading: any;
          try {
            const cleaned = response
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            grading = JSON.parse(cleaned);
          } catch (parseError) {
            this.logger.warn('Failed to parse grading response');
            grading = {
              overallScore: 0,
              feedback: response,
              parseError: true,
            };
          }

          // Save writing attempt to database
          await this.saveWritingAttempt(userId, {
            essay,
            essayType,
            gradingScale,
            topic,
            wordCount,
            grading,
          });

          // Generate motivational message
          const motivation = this.getMotivation(
            grading.overallScore,
            gradingScale,
          );

          return JSON.stringify({
            success: true,
            wordCount,
            sentenceCount,
            paragraphCount,
            grading,
            motivation,
            tips: [
              'Doc lai bai viet truoc khi nop',
              'Su dung tu noi de lien ket y',
              'Kiem tra ngu phap va chinh ta',
              'Viet thesis statement ro rang',
            ],
          });
        } catch (error) {
          this.logger.error('Essay grading error:', error);
          return JSON.stringify({
            success: false,
            error: 'Khong the cham bai viet. Vui long thu lai.',
          });
        }
      },
    });
  }

  /**
   * Tool 2: Kiem tra ngu phap chi tiet
   */
  private getGrammarCheckerTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'check_grammar',
      description: `Kiem tra loi ngu phap, chinh ta, dau cau trong van ban. Su dung khi:
- "kiem tra ngu phap", "check grammar", "sua loi cho toi"
- "cau nay dung khong", "sai cho nao"
- Hoc sinh can sua loi truoc khi nop bai
Tra ve danh sach loi va cach sua.`,
      schema: z.object({
        text: z.string().describe('Van ban can kiem tra'),
        checkLevel: z
          .enum(['basic', 'intermediate', 'advanced'])
          .optional()
          .default('intermediate')
          .describe('Muc do kiem tra chi tiet'),
      }),
      func: async ({ text, checkLevel = 'intermediate' }) => {
        try {
          this.logger.log(
            `Grammar check (${checkLevel}): ${text.substring(0, 50)}...`,
          );

          const prompt = `
You are an expert English grammar checker. Analyze the following text for errors.

TEXT TO CHECK:
"""
${text}
"""

CHECK LEVEL: ${checkLevel}
- basic: Only major grammar and spelling errors
- intermediate: Include punctuation, word choice, and common mistakes
- advanced: Include style, tone, academic writing conventions

Provide analysis in JSON format:
{
  "hasErrors": <boolean>,
  "errorCount": <number>,
  "errors": [
    {
      "id": <number>,
      "type": "<grammar/spelling/punctuation/word_choice/style>",
      "severity": "<minor/moderate/major>",
      "original": "<exact error text>",
      "position": "<approximate position or sentence number>",
      "correction": "<corrected text>",
      "explanation": "<explanation in Vietnamese>",
      "rule": "<grammar rule name>"
    }
  ],
  "correctedText": "<full text with all corrections applied>",
  "summary": {
    "grammarErrors": <count>,
    "spellingErrors": <count>,
    "punctuationErrors": <count>,
    "wordChoiceIssues": <count>,
    "styleIssues": <count>
  },
  "overallAssessment": "<brief assessment in Vietnamese>",
  "commonMistakePatterns": ["<pattern 1>", "<pattern 2>"]
}
`;

          const response = await this.gemini.generateResponse(prompt);

          let result: any;
          try {
            const cleaned = response
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            result = JSON.parse(cleaned);
          } catch (parseError) {
            result = {
              hasErrors: true,
              feedback: response,
              parseError: true,
            };
          }

          return JSON.stringify({
            success: true,
            originalText: text,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            ...result,
          });
        } catch (error) {
          this.logger.error('Grammar check error:', error);
          return JSON.stringify({
            success: false,
            error: 'Khong the kiem tra ngu phap. Vui long thu lai.',
          });
        }
      },
    });
  }

  /**
   * Tool 3: Cai thien bai viet
   */
  private getWritingImproverTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'improve_writing',
      description: `Cai thien va viet lai bai viet tot hon. Su dung khi:
- "viet lai cho hay hon", "improve my writing"
- "lam sao viet tot hon", "cai thien bai nay"
- "cho toi ban tot hon"
Tra ve phien ban cai thien voi giai thich.`,
      schema: z.object({
        text: z.string().describe('Van ban can cai thien'),
        improvementFocus: z
          .enum(['vocabulary', 'grammar', 'style', 'clarity', 'all'])
          .optional()
          .default('all')
          .describe('Tap trung cai thien gi'),
        targetLevel: z
          .enum(['maintain', 'simpler', 'more_advanced'])
          .optional()
          .default('maintain')
          .describe('Muc do phuc tap mong muon'),
        preserveMeaning: z
          .boolean()
          .optional()
          .default(true)
          .describe('Giu nguyen y chinh'),
      }),
      func: async ({
        text,
        improvementFocus = 'all',
        targetLevel = 'maintain',
        preserveMeaning = true,
      }) => {
        try {
          this.logger.log(`Improving writing, focus: ${improvementFocus}`);

          const prompt = `
You are an expert English writing coach. Improve the following text.

ORIGINAL TEXT:
"""
${text}
"""

IMPROVEMENT FOCUS: ${improvementFocus}
TARGET LEVEL: ${targetLevel}
PRESERVE MEANING: ${preserveMeaning}

Provide improvements in JSON format:
{
  "improvedText": "<fully improved version>",
  "changes": [
    {
      "original": "<original phrase>",
      "improved": "<improved phrase>",
      "reason": "<why this change in Vietnamese>",
      "category": "<vocabulary/grammar/style/clarity>"
    }
  ],
  "vocabularyUpgrades": [
    {
      "basic": "<simple word used>",
      "advanced": "<better alternative>",
      "context": "<when to use>"
    }
  ],
  "structureImprovements": "<feedback on paragraph/sentence structure>",
  "styleNotes": "<feedback on writing style>",
  "beforeAfterComparison": {
    "readabilityBefore": "<score or description>",
    "readabilityAfter": "<score or description>",
    "improvementPercentage": <number>
  },
  "learningPoints": ["<what student can learn from these changes>"]
}

Make improvements educational - explain why each change makes the writing better.
Use Vietnamese for explanations.
`;

          const response = await this.gemini.generateResponse(prompt);

          let result: any;
          try {
            const cleaned = response
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            result = JSON.parse(cleaned);
          } catch (parseError) {
            result = {
              improvedText: response,
              parseError: true,
            };
          }

          return JSON.stringify({
            success: true,
            originalWordCount: text.split(/\s+/).filter(Boolean).length,
            improvedWordCount:
              result.improvedText?.split(/\s+/).filter(Boolean).length || 0,
            ...result,
          });
        } catch (error) {
          this.logger.error('Writing improvement error:', error);
          return JSON.stringify({
            success: false,
            error: 'Khong the cai thien bai viet. Vui long thu lai.',
          });
        }
      },
    });
  }

  /**
   * Tool 4: Tao de bai viet
   */
  private getWritingPromptTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_writing_prompt',
      description: `Tao de bai viet de luyen tap. Su dung khi:
- "cho toi de bai viet", "give me a writing topic"
- "toi muon luyen viet", "writing practice"
- "de IELTS Writing Task 2"
Tra ve de bai voi huong dan va tu vung goi y.`,
      schema: z.object({
        type: z
          .enum([
            'ielts_task1',
            'ielts_task2',
            'toefl_independent',
            'toefl_integrated',
            'general_essay',
            'paragraph',
            'email',
            'letter',
            'story',
          ])
          .optional()
          .default('general_essay')
          .describe('Loai de bai'),
        topic: z
          .enum([
            'education',
            'technology',
            'environment',
            'health',
            'society',
            'work',
            'travel',
            'culture',
            'random',
          ])
          .optional()
          .default('random')
          .describe('Chu de'),
        difficulty: z
          .enum(['beginner', 'intermediate', 'advanced'])
          .optional()
          .default('intermediate')
          .describe('Do kho'),
      }),
      func: async ({
        type = 'general_essay',
        topic = 'random',
        difficulty = 'intermediate',
      }) => {
        try {
          this.logger.log(
            `Generating writing prompt: ${type}, ${topic}, ${difficulty}`,
          );

          const prompt = `
Generate an English writing prompt for practice.

TYPE: ${type}
TOPIC: ${topic}
DIFFICULTY: ${difficulty}

Provide in JSON format:
{
  "prompt": "<the writing prompt/question>",
  "type": "${type}",
  "topic": "<specific topic>",
  "difficulty": "${difficulty}",
  "wordLimit": {
    "min": <number>,
    "max": <number>,
    "recommended": <number>
  },
  "timeLimit": "<recommended time in minutes>",
  "guidelines": [
    "<guideline 1>",
    "<guideline 2>",
    "<guideline 3>"
  ],
  "suggestedOutline": {
    "introduction": "<what to include>",
    "body1": "<first main point>",
    "body2": "<second main point>",
    "conclusion": "<how to conclude>"
  },
  "usefulVocabulary": [
    {
      "word": "<word>",
      "meaning": "<Vietnamese meaning>",
      "example": "<example sentence>"
    }
  ],
  "usefulPhrases": [
    "<useful phrase for this type of writing>"
  ],
  "commonMistakesToAvoid": [
    "<mistake to avoid>"
  ],
  "sampleThesisStatements": [
    "<example thesis 1>",
    "<example thesis 2>"
  ],
  "gradingFocus": ["<what will be evaluated>"]
}

Make it educational and appropriate for the difficulty level.
Use Vietnamese for meanings and explanations where helpful.
`;

          const response = await this.gemini.generateResponse(prompt);

          let result: any;
          try {
            const cleaned = response
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            result = JSON.parse(cleaned);
          } catch (parseError) {
            result = {
              prompt: response,
              parseError: true,
            };
          }

          return JSON.stringify({
            success: true,
            ...result,
            tips: [
              'Doc ky de bai truoc khi viet',
              'Lap dan y truoc khi bat dau',
              'Danh 5 phut kiem tra lai bai',
              'Dung tool grade_essay de cham diem sau khi viet xong',
            ],
          });
        } catch (error) {
          this.logger.error('Writing prompt generation error:', error);
          return JSON.stringify({
            success: false,
            error: 'Khong the tao de bai. Vui long thu lai.',
          });
        }
      },
    });
  }

  /**
   * Tool 5: Xem lich su bai viet
   */
  private getWritingHistoryTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_writing_history',
      description: `Xem lich su va tien do bai viet. Su dung khi:
- "lich su bai viet", "writing history"
- "tien do writing cua toi", "my writing progress"
- "diem writing gan day"
Tra ve thong ke va xu huong cai thien.`,
      schema: z.object({
        userId: z.string().describe('ID cua hoc sinh'),
        limit: z.number().optional().default(10).describe('So luong bai viet'),
      }),
      func: async ({ userId, limit = 10 }) => {
        try {
          this.logger.log(`Getting writing history for user: ${userId}`);

          // Get writing attempts from database
          const attempts = await this.prisma.writingAttempt.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              essayType: true,
              topic: true,
              wordCount: true,
              score: true,
              gradingScale: true,
              feedback: true,
              createdAt: true,
            },
          });

          if (attempts.length === 0) {
            return JSON.stringify({
              success: true,
              message: 'Chua co bai viet nao. Hay bat dau luyen tap!',
              attempts: [],
              suggestion:
                'Dung tool get_writing_prompt de lay de bai luyen tap.',
            });
          }

          // Calculate statistics
          const scores = attempts.filter((a) => a.score).map((a) => a.score);
          const avgScore =
            scores.length > 0
              ? scores.reduce((a, b) => a + b, 0) / scores.length
              : 0;

          const totalWords = attempts.reduce(
            (sum, a) => sum + (a.wordCount || 0),
            0,
          );

          // Analyze trend
          const recentScores = scores.slice(0, 5);
          const olderScores = scores.slice(5, 10);
          const recentAvg =
            recentScores.length > 0
              ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
              : 0;
          const olderAvg =
            olderScores.length > 0
              ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length
              : 0;

          const trend =
            recentAvg > olderAvg + 5
              ? 'improving'
              : recentAvg < olderAvg - 5
                ? 'declining'
                : 'stable';

          // Group by essay type
          const byType = new Map<string, number>();
          attempts.forEach((a) => {
            byType.set(a.essayType, (byType.get(a.essayType) || 0) + 1);
          });

          return JSON.stringify({
            success: true,
            summary: {
              totalAttempts: attempts.length,
              totalWords,
              averageScore: Math.round(avgScore * 10) / 10,
              trend,
              trendMessage:
                trend === 'improving'
                  ? 'Tuyet voi! Diem dang tang len!'
                  : trend === 'declining'
                    ? 'Can co gang hon! Luyen tap them nhe.'
                    : 'On dinh. Tiep tuc phat huy!',
            },
            byType: Object.fromEntries(byType),
            recentAttempts: attempts.slice(0, 5).map((a) => ({
              id: a.id,
              type: a.essayType,
              topic: a.topic,
              wordCount: a.wordCount,
              score: a.score,
              date: a.createdAt,
            })),
            recommendations: this.getWritingRecommendations(
              avgScore,
              trend,
              attempts,
            ),
          });
        } catch (error) {
          this.logger.error('Writing history error:', error);
          return JSON.stringify({
            success: false,
            error: 'Khong the lay lich su bai viet.',
          });
        }
      },
    });
  }

  // ==================== Helper Methods ====================

  private getGradingCriteria(scale: string): string {
    switch (scale) {
      case 'ielts':
        return `
IELTS Writing Band Descriptors (0-9):
- Task Achievement (25%): Address all parts of task, present clear position
- Coherence & Cohesion (25%): Logical organization, paragraphing, linking
- Lexical Resource (25%): Vocabulary range, accuracy, appropriateness
- Grammatical Range & Accuracy (25%): Sentence structures, error frequency
`;
      case 'toefl':
        return `
TOEFL Writing Scoring (0-30):
- Development (33%): Relevant examples, explanations, details
- Organization (33%): Unity, progression, coherence
- Language Use (34%): Sentence variety, vocabulary, grammar
`;
      case 'cefr':
        return `
CEFR Writing Assessment (A1-C2):
- Range: Vocabulary and structure complexity
- Accuracy: Grammar and spelling correctness
- Coherence: Text organization and flow
- Interaction: Appropriateness for purpose
`;
      default:
        return `
General Writing Assessment (0-100):
- Content (25%): Ideas, relevance, depth
- Organization (25%): Structure, flow, paragraphing
- Language (25%): Grammar, vocabulary, spelling
- Style (25%): Tone, clarity, engagement
`;
    }
  }

  private getMotivation(score: number, scale: string): string {
    let percentage = score;
    if (scale === 'ielts') {
      percentage = (score / 9) * 100;
    } else if (scale === 'toefl') {
      percentage = (score / 30) * 100;
    }

    if (percentage >= 80) {
      return 'Tuyet voi! Ban viet rat tot. Tiep tuc phat huy!';
    } else if (percentage >= 70) {
      return 'Tot lam! Chi can cai thien mot chut nua la hoan hao.';
    } else if (percentage >= 60) {
      return 'Kha tot! Co gang sua cac loi ngu phap de tang diem.';
    } else if (percentage >= 50) {
      return 'Duoc roi! Tap trung vao cau truc bai va tu vung.';
    } else {
      return 'Hay luyen tap them! Xem goi y cai thien va thu lai nhe.';
    }
  }

  private async saveWritingAttempt(userId: string, data: any): Promise<void> {
    try {
      await this.prisma.writingAttempt.create({
        data: {
          userId,
          essay: data.essay,
          essayType: data.essayType,
          gradingScale: data.gradingScale,
          topic: data.topic || null,
          wordCount: data.wordCount,
          score: data.grading?.overallScore || null,
          feedback: data.grading ? JSON.stringify(data.grading) : null,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to save writing attempt:', error);
      // Non-critical, don't throw
    }
  }

  private getWritingRecommendations(
    avgScore: number,
    trend: string,
    attempts: any[],
  ): string[] {
    const recommendations: string[] = [];

    if (avgScore < 60) {
      recommendations.push('Tap trung vao ngu phap co ban truoc');
      recommendations.push('Viet cau ngan, don gian truoc');
    } else if (avgScore < 75) {
      recommendations.push('Tang cuong tu vung academic');
      recommendations.push('Luyen viet thesis statement ro rang');
    } else {
      recommendations.push('Thu thach voi de bai kho hon');
      recommendations.push('Tap trung vao style va coherence');
    }

    if (trend === 'declining') {
      recommendations.push('Xem lai feedback cac bai truoc');
      recommendations.push('Luyen tap deu dan moi ngay');
    }

    if (attempts.length < 5) {
      recommendations.push('Viet it nhat 2-3 bai/tuan de tien bo');
    }

    return recommendations;
  }
}
