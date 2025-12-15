import { PrismaRepository } from '@app/database';
import { GeminiService, LLMAnalysisResult } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { MispronounceWord, PersonalizedDrill } from '@prisma/client';

const SYSTEM_PROMPT = `Bạn là chuyên gia phát âm tiếng Anh cho người Việt.
Focus vào các âm khó với người Việt: /θ/, /ð/, /r/, /l/, /ʃ/, /tʃ/, /dʒ/, /ŋ/, /z/, /v/
Phân tích pattern lỗi và đề xuất bài tập cụ thể.
Trả về valid JSON.`;

@Injectable()
export class PersonalizationLLMService {
  private readonly logger = new Logger(PersonalizationLLMService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly geminiService: GeminiService,
  ) {}

  /**
   * Analyze mispronounced words and generate personalized drill
   * Called when totalWords % 10 === 0
   */
  async analyzeAndGenerateDrill(
    userId: string,
  ): Promise<PersonalizedDrill | null> {
    this.logger.log(`Starting LLM analysis for user ${userId}`);

    // 1. Get top mispronounced words (errorCount >= 2)
    const words = await this.prisma.mispronounceWord.findMany({
      where: { userId, errorCount: { gte: 2 } },
      orderBy: { errorCount: 'desc' },
      take: 10,
    });

    if (words.length < 3) {
      this.logger.log(
        `User ${userId} has less than 3 qualifying words, skipping LLM analysis`,
      );
      return null;
    }

    // 2. Build prompt and call LLM
    const prompt = this.buildPrompt(words);
    const analysis = await this.callLLM(prompt);

    if (!analysis) {
      this.logger.error(`Failed to get LLM analysis for user ${userId}`);
      return null;
    }

    // 3. Save personalized drill
    const progress = await this.prisma.speakingPracticeProgress.findUnique({
      where: { userId },
    });

    const drill = await this.prisma.personalizedDrill.create({
      data: {
        userId,
        progressId: progress?.id,
        generatedBy: 'llm',
        analysis: analysis.summary,
        targetWords: analysis.drillWords.map((d) => d.word),
        targetSentences: analysis.practiceSentences || [],
        targetPhonemes: analysis.weakPhonemes || [],
        sourceWordIds: words.map((w) => w.id),
        status: 'pending',
        priority: 1,
      },
    });

    this.logger.log(
      `Created personalized drill ${drill.id} for user ${userId} with ${analysis.drillWords.length} words`,
    );

    return drill;
  }

  /**
   * Build LLM prompt from mispronounced words
   */
  private buildPrompt(words: MispronounceWord[]): string {
    const wordList = words
      .map(
        (w) =>
          `- "${w.word}" (${w.errorCount} lần)${w.problematicPhoneme ? `: ${w.problematicPhoneme}` : ''}${w.contextSentence ? ` - context: "${w.contextSentence}"` : ''}`,
      )
      .join('\n');

    return `${SYSTEM_PROMPT}

Phân tích lỗi phát âm của học sinh người Việt:

${wordList}

Trả về JSON với cấu trúc:
{
  "summary": "Tóm tắt điểm yếu chính của học sinh (tiếng Việt)",
  "weakPhonemes": ["/θ/", "/ð/"],
  "drillWords": [
    { "word": "three", "priority": 1 },
    { "word": "birthday", "priority": 2 }
  ],
  "practiceSentences": [
    "I think three is enough",
    "Happy birthday to you"
  ]
}

Lưu ý:
- drillWords: 5-10 từ, ưu tiên từ có errorCount cao
- practiceSentences: 3-5 câu ngắn, dễ nhớ, chứa các từ trong drillWords
- weakPhonemes: liệt kê các âm IPA mà học sinh thường sai`;
  }

  /**
   * Call Gemini LLM for analysis
   */
  private async callLLM(prompt: string): Promise<LLMAnalysisResult | null> {
    try {
      const response = await this.geminiService.generateJSONResponse(prompt);
      const parsed = JSON.parse(response);

      // Validate response structure
      if (
        !parsed.summary ||
        !Array.isArray(parsed.drillWords) ||
        parsed.drillWords.length === 0
      ) {
        this.logger.warn('Invalid LLM response structure', { parsed });
        return null;
      }

      return {
        summary: parsed.summary,
        weakPhonemes: parsed.weakPhonemes || [],
        drillWords: parsed.drillWords.map((d: any) => ({
          word: d.word,
          priority: d.priority || 1,
        })),
        practiceSentences: parsed.practiceSentences || [],
      };
    } catch (error) {
      this.logger.error('Failed to parse LLM response', error);
      return null;
    }
  }
}
