import { PrismaRepository } from '@app/database';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from '@app/shared';
import { SpeechClient } from '@google-cloud/speech';
import type { google } from '@google-cloud/speech/build/protos/protos';
import {
  validatePronunciation,
  ValidationDecision,
  ValidationResult,
  SimilarityScores,
} from '@app/shared/utils/text-similarity.util';
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
  contentMatch?: string; // 'none' | 'partial' | 'full' from Gemini
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
    private readonly configService: ConfigService,
  ) {
    this.speechClient = this.initializeSpeechClient();
  }

  // Configuration getters for text similarity validation
  private get similarityThresholdMin(): number {
    return this.configService.get<number>(
      'PRONUNCIATION_SIMILARITY_THRESHOLD_MIN',
      0.6,
    );
  }

  private get similarityThresholdGood(): number {
    return this.configService.get<number>(
      'PRONUNCIATION_SIMILARITY_THRESHOLD_GOOD',
      0.8,
    );
  }

  private get enableTextSimilarity(): boolean {
    return this.configService.get<boolean>(
      'ENABLE_TEXT_SIMILARITY_VALIDATION',
      true,
    );
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

  /**
   * Validate pronunciation transcript matches target phrase using text similarity
   * @returns ValidationResult with decision, scores, and penalty
   */
  private validateTranscriptSimilarity(
    targetPhrase: string,
    transcript: string,
  ): ValidationResult {
    const startTime = Date.now();

    try {
      const result = validatePronunciation(targetPhrase, transcript, {
        minThreshold: this.similarityThresholdMin,
        goodThreshold: this.similarityThresholdGood,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Text similarity validation completed in ${duration}ms: decision=${result.decision}, combined=${result.similarity.combined.toFixed(3)}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Text similarity validation failed: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Fallback: accept with penalty if validation fails
      return {
        decision: ValidationDecision.ADJUST_SCORE,
        similarity: {
          jaroWinkler: 0,
          cosine: 0,
          levenshtein: 0,
          combined: 0.7,
        },
        miscues: {
          extraWords: [],
          missingWords: [],
          repeatedWords: [],
          matchedWords: [],
        },
        penalty: 0.85,
        feedback:
          'Không thể xác minh hoàn toàn nội dung. Điểm có thể không chính xác.',
      };
    }
  }

  /**
   * Cross-validate Gemini's contentMatch with algorithmic similarity scores
   * Returns adjusted decision and penalty
   */
  private crossValidateResults(
    geminiContentMatch: string | undefined,
    validationResult: ValidationResult,
    originalScore: number,
  ): {
    finalDecision: ValidationDecision;
    finalPenalty: number;
    adjustedScore: number;
    feedback: string;
  } {
    const similarity = validationResult.similarity.combined;
    const geminiMatch = geminiContentMatch || 'unknown';

    let finalDecision = validationResult.decision;
    let finalPenalty = validationResult.penalty;
    let feedback = validationResult.feedback;

    // Cross-validation matrix
    if (geminiMatch === 'none') {
      if (similarity < 0.6) {
        // Both agree: reject
        finalDecision = ValidationDecision.REJECT;
        finalPenalty = 0;
        this.logger.log(
          `Cross-validation: Both reject (Gemini=none, similarity=${similarity.toFixed(3)})`,
        );
      } else if (similarity >= 0.6 && similarity < 0.8) {
        // Gemini says none, but algorithms detect partial match
        // Trust algorithms with caution
        finalDecision = ValidationDecision.ADJUST_SCORE;
        finalPenalty = Math.max(0.5, validationResult.penalty * 0.7); // Heavy penalty
        feedback =
          'Nội dung có thể chưa chính xác. ' + validationResult.feedback;
        this.logger.warn(
          `Cross-validation mismatch: Gemini=none but similarity=${similarity.toFixed(3)}`,
        );
      } else {
        // Gemini says none, but algorithms confident it's good
        // Trust algorithms (Gemini may have misheard)
        finalDecision = ValidationDecision.ADJUST_SCORE;
        finalPenalty = 0.85; // Minor penalty for inconsistency
        feedback =
          'Hệ thống phát hiện nội dung khớp. Điểm được điều chỉnh nhẹ.';
        this.logger.warn(
          `Cross-validation override: Gemini=none but similarity=${similarity.toFixed(3)}, trusting algorithms`,
        );
      }
    } else if (geminiMatch === 'partial') {
      if (similarity < 0.6) {
        // Algorithms say reject, Gemini says partial
        // Trust algorithms (stricter)
        finalDecision = ValidationDecision.REJECT;
        finalPenalty = 0;
        feedback = 'Nội dung không khớp với câu mục tiêu. Vui lòng đọc lại.';
        this.logger.warn(
          `Cross-validation override: Gemini=partial but similarity=${similarity.toFixed(3)}, rejecting`,
        );
      } else {
        // Both agree on partial/adjust
        finalDecision = ValidationDecision.ADJUST_SCORE;
        finalPenalty = validationResult.penalty;
        this.logger.log(
          `Cross-validation: Both agree on partial match (similarity=${similarity.toFixed(3)})`,
        );
      }
    } else if (geminiMatch === 'full') {
      if (similarity < 0.6) {
        // Gemini says full, algorithms say reject
        // Trust algorithms (Gemini too lenient)
        finalDecision = ValidationDecision.ADJUST_SCORE;
        finalPenalty = 0.55; // Heavy penalty
        feedback =
          'Phát hiện một số từ chưa chính xác. ' + validationResult.feedback;
        this.logger.warn(
          `Cross-validation override: Gemini=full but similarity=${similarity.toFixed(3)}, applying penalty`,
        );
      } else if (similarity >= 0.6 && similarity < 0.8) {
        // Gemini says full, algorithms say adjust
        // Apply minor penalty
        finalDecision = ValidationDecision.ADJUST_SCORE;
        finalPenalty = Math.max(0.8, validationResult.penalty);
        this.logger.log(
          `Cross-validation: Minor adjustment despite Gemini=full (similarity=${similarity.toFixed(3)})`,
        );
      } else {
        // Both agree: accept
        finalDecision = ValidationDecision.ACCEPT;
        finalPenalty = 1.0;
        this.logger.log(
          `Cross-validation: Both accept (Gemini=full, similarity=${similarity.toFixed(3)})`,
        );
      }
    } else {
      // Unknown contentMatch from Gemini (shouldn't happen after Phase 2)
      // Trust algorithms entirely
      this.logger.warn(
        `Gemini contentMatch unknown: "${geminiMatch}", relying on algorithms only`,
      );
    }

    const adjustedScore = Math.max(0, Math.round(originalScore * finalPenalty));

    return { finalDecision, finalPenalty, adjustedScore, feedback };
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

    // Layer 2: Text similarity validation (NEW)
    if (this.enableTextSimilarity) {
      const validationResult = this.validateTranscriptSimilarity(
        dto.phrase,
        result.transcript || '',
      );

      // Layer 3: Cross-validate and decide (NEW)
      const crossValidation = this.crossValidateResults(
        result.contentMatch,
        validationResult,
        result.score,
      );

      // Log detailed metrics for monitoring
      this.logger.log({
        event: 'pronunciation_validation_complete',
        targetPhrase: dto.phrase,
        transcript: result.transcript,
        originalScore: result.score,
        adjustedScore: crossValidation.adjustedScore,
        geminiContentMatch: result.contentMatch,
        similarityScores: {
          jaroWinkler: validationResult.similarity.jaroWinkler.toFixed(3),
          cosine: validationResult.similarity.cosine.toFixed(3),
          levenshtein: validationResult.similarity.levenshtein.toFixed(3),
          combined: validationResult.similarity.combined.toFixed(3),
        },
        miscues: validationResult.miscues,
        decision: crossValidation.finalDecision,
        penalty: crossValidation.finalPenalty.toFixed(3),
      });

      // Handle rejection (content mismatch)
      if (crossValidation.finalDecision === ValidationDecision.REJECT) {
        throw new BadRequestException(crossValidation.feedback);
      }

      // Apply score adjustment if needed
      if (crossValidation.finalDecision === ValidationDecision.ADJUST_SCORE) {
        result.score = crossValidation.adjustedScore;

        // Enhance feedback with similarity details
        if (validationResult.miscues.missingWords.length > 0) {
          result.feedback += ` Bạn đã bỏ sót: "${validationResult.miscues.missingWords.join('", "')}".`;
        }
        if (validationResult.miscues.extraWords.length > 0) {
          result.feedback += ` Bạn đã nói thêm: "${validationResult.miscues.extraWords.join('", "')}".`;
        }

        // Update detail object with miscues
        result.detail = {
          ...result.detail,
          missingWords: validationResult.miscues.missingWords,
          extraWords: validationResult.miscues.extraWords,
          similarityScore: validationResult.similarity.combined,
          penaltyApplied: crossValidation.finalPenalty,
        };
      }
    } else {
      this.logger.warn('Text similarity validation disabled via config');
    }

    // Layer 4: Persist result
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
