import { PrismaRepository } from '@app/database';
import { GeminiService, TtsService } from '@app/shared';
import { PodcastCategory, PodcastDifficulty, UserRole } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jsonrepair } from 'jsonrepair';

interface GeminiGeneratedPodcastDto {
  title: string;
  description: string;
  transcript: string;
  answers: string[];
  audioScript?: string;
  thumbnailKeyword?: string;
  language?: string;
  estimatedDurationSeconds?: number;
}

interface ParsedTranscript {
  cleanTranscript: string;
  gaps: Array<{
    startIndex: number;
    endIndex: number;
    answer: string;
    orderNo: number;
  }>;
  gapWordCount: number;
  totalWordCount: number;
}

@Injectable()
export class PodcastGenerationService {
  private readonly logger = new Logger(PodcastGenerationService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly geminiService: GeminiService,
    private readonly ttsService: TtsService,
    private readonly configService: ConfigService,
  ) {}

  async generateDailyPodcasts(): Promise<void> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const existingCount = await this.prisma.podcast.count({
      where: {
        createdAt: { gte: startOfDay },
        code: { startsWith: 'auto-' },
      },
    });

    if (existingCount >= 10) {
      this.logger.log('Auto podcasts already generated for today. Skipping.');
      return;
    }

    const author = await this.prisma.user.findFirst({
      where: { role: UserRole.teacher },
      orderBy: { createdAt: 'asc' },
    });

    if (!author) {
      this.logger.warn('No teacher user found. Cannot create auto podcasts.');
      return;
    }

    const categories = Object.values(PodcastCategory);
    const assignments = this.pickCategories(categories, 10);

    let created = existingCount;
    for (const { category, index } of assignments) {
      try {
        const content = await this.generatePodcastWithGemini(category, index);
        await this.prisma.podcast.create({
          data: {
            code: this.generateCode(now, created),
            title: content.title,
            description: content.description,
            transcript: content.transcript,
            audioUrl: content.audioUrl,
            thumbnailUrl: content.thumbnailUrl,
            category,
            difficulty: PodcastDifficulty.intermediate,
            duration: content.duration,
            authorId: author.id,
            gaps: {
              create: content.gaps,
            },
          },
        });
        created++;
      } catch (error) {
        this.logger.error(
          `Failed to create auto podcast for category ${category}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    this.logger.log(
      `Generated ${created - existingCount} auto podcasts for ${now.toDateString()}.`,
    );
  }

  private generateCode(baseDate: Date, index: number): string {
    const y = baseDate.getFullYear();
    const m = (baseDate.getMonth() + 1).toString().padStart(2, '0');
    const d = baseDate.getDate().toString().padStart(2, '0');
    return `auto-${y}${m}${d}-${index}`;
  }

  private pickCategories(
    categories: PodcastCategory[],
    target: number,
  ): Array<{ category: PodcastCategory; index: number }> {
    const shuffled = [...categories].sort(() => Math.random() - 0.5);
    const result: Array<{ category: PodcastCategory; index: number }> = [];
    let idx = 0;

    while (result.length < target) {
      const category = shuffled[result.length % shuffled.length];
      result.push({ category, index: idx + 1 });
      idx++;
      if (result.length >= target) break;
    }

    return result;
  }

  private async generatePodcastWithGemini(
    category: PodcastCategory,
    ordinal: number,
  ) {
    const prompt = this.buildGeminiPrompt(category, ordinal);
    const raw = await this.geminiService.generateResponse(prompt);
    const parsed = this.parseGeminiOutput(raw);

    const transcriptData = this.extractTranscript(
      parsed.transcript,
      parsed.answers,
    );
    const coverage =
      transcriptData.totalWordCount === 0
        ? 0
        : transcriptData.gapWordCount / transcriptData.totalWordCount;

    if (coverage < 0.7) {
      throw new Error(
        `Gap coverage ${Math.round(coverage * 100)}% is below requirement for category ${category}`,
      );
    }

    const duration = this.normaliseDuration(
      parsed.estimatedDurationSeconds,
      transcriptData.totalWordCount,
    );

    const audioText = this.selectAudioScript(
      parsed,
      transcriptData.cleanTranscript,
    );
    const audioUrl = await this.generateAudio(
      audioText,
      parsed.language ?? 'en',
    );
    const thumbnailUrl = this.buildThumbnailUrl(
      parsed.thumbnailKeyword ?? this.formatCategory(category),
    );

    return {
      title: parsed.title,
      description: parsed.description,
      transcript: transcriptData.cleanTranscript,
      gaps: transcriptData.gaps,
      duration,
      audioUrl,
      thumbnailUrl,
    };
  }

  private buildGeminiPrompt(
    category: PodcastCategory,
    ordinal: number,
  ): string {
    const categoryLabel = this.formatCategory(category);
    return `You are an ESL content creator. Generate a fresh intermediate (CEFR B1-B2) listening transcript for adult learners focused on the theme "${categoryLabel}".
Return ONLY valid JSON (no Markdown, no explanation) matching the schema:
{
  "title": string,
  "description": string,
  "transcript": string,
  "answers": string[],
  "audioScript": string,
  "thumbnailKeyword": string,
  "language": string,
  "estimatedDurationSeconds": number
}
Guidelines:
- Title should be unique and engaging. Include the sequence number #${ordinal} somewhere.
- Description: 1-2 sentences summarising the story.
- Transcript: 380-520 words, conversational tone, split into natural sentences.
- Mark AT LEAST 70% of total words as gaps using the format [word] directly inside the transcript. Use the original word inside the brackets (e.g. [journey]).
- Provide the list of gap answers in "answers" following the exact order they appear.
- audioScript: maximum 90 words, friendly summary learners can listen to before studying.
- Use English language (language = "en").
- estimatedDurationSeconds should be between 240 and 420.
- Do not include backticks in the JSON, do not escape newlines with \n. Use standard JSON quoting.`;
  }

  private parseGeminiOutput(raw: string): GeminiGeneratedPodcastDto {
    try {
      const repaired = jsonrepair(raw);
      const parsed = JSON.parse(repaired);

      if (!parsed.transcript || !parsed.answers) {
        throw new Error('Missing transcript or answers');
      }

      return parsed;
    } catch (error) {
      this.logger.error('Failed to parse Gemini podcast output', error as any);
      throw new Error('Gemini podcast output is invalid JSON');
    }
  }

  private extractTranscript(
    transcriptWithGaps: string,
    answers: string[],
  ): ParsedTranscript {
    const regex = /\[([^\]]+)\]/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    let order = 1;
    let cleanTranscript = '';
    const gaps: ParsedTranscript['gaps'] = [];
    let gapWordCount = 0;

    while ((match = regex.exec(transcriptWithGaps)) !== null) {
      const before = transcriptWithGaps.substring(lastIndex, match.index);
      cleanTranscript += before;

      const bracketContent = match[1].trim();
      const answerFromList = answers[order - 1]?.trim();
      const answer =
        answerFromList && answerFromList.length > 0
          ? answerFromList
          : bracketContent;

      const startIndex = cleanTranscript.length;
      cleanTranscript += answer;
      const endIndex = cleanTranscript.length;

      gapWordCount += answer.split(/\s+/).filter(Boolean).length;

      gaps.push({
        startIndex,
        endIndex,
        answer,
        orderNo: order,
      });

      order++;
      lastIndex = match.index + match[0].length;
    }

    cleanTranscript += transcriptWithGaps.substring(lastIndex);
    const totalWordCount = this.countWords(cleanTranscript);

    return { cleanTranscript, gaps, gapWordCount, totalWordCount };
  }

  private countWords(text: string): number {
    return text
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(Boolean).length;
  }

  private normaliseDuration(
    estimatedDurationSeconds: number | undefined,
    totalWords: number,
  ): number {
    if (estimatedDurationSeconds && estimatedDurationSeconds >= 180) {
      return Math.min(420, Math.max(240, Math.round(estimatedDurationSeconds)));
    }

    const seconds = Math.round((totalWords / 130) * 60);
    return Math.min(420, Math.max(240, seconds || 300));
  }

  private selectAudioScript(
    parsed: GeminiGeneratedPodcastDto,
    cleanTranscript: string,
  ): string {
    if (parsed.audioScript && parsed.audioScript.trim().length > 0) {
      return parsed.audioScript.trim().slice(0, 1000);
    }

    const sentences = cleanTranscript.split(/(?<=[.!?])\s+/).filter(Boolean);
    return sentences.slice(0, 3).join(' ').slice(0, 600);
  }

  private async generateAudio(text: string, language: string) {
    const lang = language?.split('-')[0]?.toLowerCase() || 'en';
    const supported = this.ttsService.isLanguageSupported(lang) ? lang : 'en';

    try {
      const trimmed = text.trim().slice(0, 1000);
      const result = await this.ttsService.createAudioWithUrl(
        trimmed,
        supported,
      );
      return result.url;
    } catch (error) {
      this.logger.error(
        'TTS generation failed, falling back to configured audio',
        error as any,
      );
      const fallbackEndpoint =
        this.configService.get<string>('FALLBACK_AUDIO_URL') ??
        'https://filesamples.com/samples/audio/mp3/sample3.mp3';
      return fallbackEndpoint;
    }
  }

  private buildThumbnailUrl(keyword: string): string {
    const safeKeyword = keyword
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, '+');
    return `https://source.unsplash.com/featured/600x400?${safeKeyword || 'learning'}`;
  }

  private formatCategory(category: PodcastCategory): string {
    return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
