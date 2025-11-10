import { PrismaRepository } from '@app/database';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '@app/shared';
import { SpeechClient } from '@google-cloud/speech';
import type { google } from '@google-cloud/speech/build/protos/protos';
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
  private readonly speechClient: SpeechClient | null;

  constructor(
    private readonly geminiService: GeminiService,
    private readonly prisma: PrismaRepository,
  ) {
    this.speechClient = this.initializeSpeechClient();
  }

  private initializeSpeechClient(): SpeechClient | null {
    try {
      return new SpeechClient();
    } catch (error) {
      this.logger.warn(
        `Google Speech-to-Text client chưa được cấu hình (bỏ qua kiểm tra im lặng): ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  async evaluatePronunciation(
    userId: string,
    dto: EvaluatePronunciationDto,
  ): Promise<EvaluationResultDto> {
    this.ensureAudioPayload(
      dto.audioBase64,
      'Không tìm thấy dữ liệu ghi âm để chấm.',
    );

    // Basic validation - detailed silence detection will be done by Gemini
    const audioBuffer = Buffer.from(dto.audioBase64, 'base64');
    if (audioBuffer.length < 1024) {
      // Audio too small, likely corrupted or empty
      throw new BadRequestException(
        'Ghi âm không hợp lệ. Vui lòng ghi âm lại.',
      );
    }

    await this.ensureSpeechDetected(dto.audioBase64, dto.mimeType, dto.phrase);

    const result = await this.geminiService.evaluatePronunciation({
      audioBase64: dto.audioBase64,
      mimeType: dto.mimeType,
      targetPhrase: dto.phrase,
    });

    // Check if Gemini detected silence/empty audio
    // Priority: transcript empty > feedback contains silence keywords > score 0 with empty transcript
    const transcriptEmpty =
      !result.transcript || result.transcript.trim() === '';
    const feedbackLower = result.feedback?.toLowerCase() || '';
    const isSilenceDetected =
      feedbackLower.includes('không nhận được') ||
      feedbackLower.includes('im lặng') ||
      feedbackLower.includes('không nghe thấy') ||
      feedbackLower.includes('chưa nói gì') ||
      feedbackLower.includes('ghi âm quá ngắn') ||
      feedbackLower.includes('không có âm thanh');

    if (transcriptEmpty || isSilenceDetected) {
      this.logger.warn(
        `Silence detected in pronunciation evaluation: transcript="${result.transcript}", feedback="${result.feedback}"`,
      );
      throw new BadRequestException(
        'Không phát hiện được giọng nói trong ghi âm. Bạn chưa nói gì hoặc ghi âm quá ngắn. Vui lòng nói rõ ràng và ghi âm lại.',
      );
    }

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

  private detectAudioEncoding(
    mimeType?: string,
  ): google.cloud.speech.v1.RecognitionConfig.AudioEncoding {
    if (mimeType) {
      if (mimeType.includes('webm')) return 'WEBM_OPUS' as any;
      if (mimeType.includes('ogg')) return 'OGG_OPUS' as any;
      if (mimeType.includes('mp3')) return 'MP3' as any;
      if (mimeType.includes('flac')) return 'FLAC' as any;
      if (mimeType.includes('wav')) return 'LINEAR16' as any;
    }
    return 'WEBM_OPUS' as any;
  }

  private calculateSpeechDuration(
    results:
      | google.cloud.speech.v1.ISpeechRecognitionResult[]
      | null
      | undefined,
  ): number {
    if (!results || results.length === 0) return 0;
    const last = results[results.length - 1];
    const end = last.resultEndTime;
    if (!end) return 0;
    const seconds = Number(end.seconds ?? 0);
    const nanos = Number(end.nanos ?? 0);
    return seconds + nanos / 1_000_000_000;
  }

  private async ensureSpeechDetected(
    audioBase64: string,
    mimeType?: string,
    referenceText?: string,
  ): Promise<void> {
    if (!this.speechClient) {
      this.logger.warn(
        'Bỏ qua kiểm tra im lặng vì Google Speech-to-Text chưa được cấu hình.',
      );
      return;
    }

    try {
      const encoding = this.detectAudioEncoding(mimeType);
      const config: google.cloud.speech.v1.IRecognitionConfig = {
        encoding,
        languageCode: 'en-US',
        enableAutomaticPunctuation: false,
        enableWordConfidence: true,
        enableWordTimeOffsets: true,
        model: 'latest_short',
        useEnhanced: true,
      };

      if (referenceText) {
        config.speechContexts = [
          {
            phrases: [referenceText],
            boost: 10,
          },
        ];
      }

      const [response] = await this.speechClient.recognize({
        config,
        audio: { content: audioBase64 },
      });

      const alternative = response.results?.[0]?.alternatives?.[0];
      const transcript = alternative?.transcript?.trim() ?? '';
      const confidence = alternative?.confidence ?? 0;
      const durationSec = this.calculateSpeechDuration(response.results);

      if (!transcript) {
        throw new BadRequestException(
          'Không phát hiện được giọng nói trong ghi âm. Bạn chưa nói gì hoặc ghi âm quá ngắn. Vui lòng nói rõ ràng và ghi âm lại.',
        );
      }

      if (confidence < 0.3 || durationSec < 0.5) {
        throw new BadRequestException(
          'Ghi âm quá ngắn hoặc không rõ ràng. Vui lòng nói to và ghi âm lại.',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        'Kiểm tra Google Speech-to-Text thất bại',
        error as any,
      );
      // Nếu STT lỗi (ví dụ quota, cấu hình), tiếp tục quy trình để tránh chặn người dùng
    }
  }
}
