import { PrismaRepository } from '@app/database';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '@app/shared';
import {
  EvaluatePronunciationDto,
  EvaluateSpeechDto,
  EvaluateWritingDto,
  EvaluationCategoryDto,
  EvaluationResultDto,
} from '../dto/evaluation.dto';

interface SpeechEvaluationResult {
  score: number;
  feedback: string;
  transcript?: string;
  categories?: EvaluationCategoryDto[];
  detail?: Record<string, any> | null;
}

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly prisma: PrismaRepository,
  ) {}

  async evaluatePronunciation(
    userId: string,
    dto: EvaluatePronunciationDto,
  ): Promise<EvaluationResultDto> {
    this.ensureAudioPayload(
      dto.audioBase64,
      'Không tìm thấy dữ liệu ghi âm để chấm.',
    );
    const result = await this.geminiService.evaluatePronunciation({
      audioBase64: dto.audioBase64,
      mimeType: dto.mimeType,
      targetPhrase: dto.phrase,
    });

    // activityId is optional - only persist if provided and valid
    return this.persistResult(userId, dto.activityId, result);
  }

  async evaluateSpeaking(
    userId: string,
    dto: EvaluateSpeechDto,
  ): Promise<EvaluationResultDto> {
    this.ensureAudioPayload(
      dto.audioBase64,
      'Ghi âm bài nói đang trống, vui lòng thử lại.',
    );
    const result = await this.geminiService.evaluateSpeaking({
      audioBase64: dto.audioBase64,
      mimeType: dto.mimeType,
      prompt: dto.prompt,
      minSeconds: dto.minSeconds,
    });

    return this.persistResult(userId, dto.activityId, result);
  }

  async evaluateWriting(
    userId: string,
    dto: EvaluateWritingDto,
  ): Promise<EvaluationResultDto> {
    const result = await this.geminiService.evaluateWriting({
      submission: dto.submission,
      prompt: dto.prompt,
      minWords: dto.minWords,
    });

    return this.persistResult(userId, dto.activityId, result);
  }

  private async persistResult(
    userId: string,
    activityId: string | undefined,
    result: SpeechEvaluationResult,
  ): Promise<EvaluationResultDto> {
    const score = Number.isFinite(result.score)
      ? Math.min(Math.max(Math.round(result.score), 0), 100)
      : 0;

    let attemptId: string;

    // Only save to database if activityId is provided and exists
    if (activityId) {
      // Check if activityId exists in Activity table
      const activityExists = await this.prisma.activity.findUnique({
        where: { id: activityId },
        select: { id: true },
      });

      if (activityExists) {
        // Activity exists, save attempt to database
        const attempt = await this.prisma.attempt.create({
          data: {
            userId,
            activityId,
            score,
            maxScore: 100,
            detail: result.detail ?? {
              categories: result.categories,
              transcript: result.transcript,
            },
            feedback: result.feedback,
          },
        });
        attemptId = attempt.id;
      } else {
        // Activity doesn't exist, skip saving but still return result
        this.logger.warn(
          `Activity ${activityId} not found. Skipping attempt persistence for user ${userId}.`,
        );
        attemptId = this.generateTemporaryId();
      }
    } else {
      // No activityId provided (e.g., vocabulary review), just return result without saving
      this.logger.debug(
        `No activityId provided for pronunciation evaluation. Returning result without persistence.`,
      );
      attemptId = this.generateTemporaryId();
    }

    return {
      attemptId,
      score,
      feedback: result.feedback,
      categories: result.categories,
      transcript: result.transcript,
      detail: result.detail ?? null,
    };
  }

  private generateTemporaryId(): string {
    // Generate a UUID v4-like string for temporary attempts
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private ensureAudioPayload(base64: string, message: string) {
    const MIN_AUDIO_BYTES = 2048; // ~2KB to filter out empty/very short submissions

    if (!base64 || typeof base64 !== 'string') {
      throw new BadRequestException(message);
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      throw new BadRequestException('Định dạng audio không hợp lệ.');
    }

    if (!buffer.byteLength || buffer.byteLength < MIN_AUDIO_BYTES) {
      throw new BadRequestException(message);
    }
  }
}
