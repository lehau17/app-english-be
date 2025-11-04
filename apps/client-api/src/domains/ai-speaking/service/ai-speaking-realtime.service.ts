import { ProfanityBanService, ProfanityDetectionService } from '@app/shared';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiSpeakingSessionState,
  AiSpeakingTurnStatus,
  Prisma,
} from '@prisma/client';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { UploadService } from '../../upload/upload.service';
import { AiSpeakingGateway } from '../gateway/ai-speaking.gateway';
import { AiSpeakingRepository } from '../repository/ai-speaking.repository';
import { AiSpeakingTurnManager } from './ai-speaking-turn-manager.service';
import {
  RealtimeAsrService,
  RealtimeAsrSessionHandle,
} from './realtime-asr.service';
import { RealtimeTtsService } from './realtime-tts.service';

interface StreamAiTurnOptions {
  voiceHint?: string;
}

interface ActiveAsrSession {
  handle: RealtimeAsrSessionHandle;
  buffers: Buffer[];
  mimeType: string;
  startedAt: number;
  hasTransitionedToUserSpeaking: boolean;
  silenceTimer?: NodeJS.Timeout;
  silenceCount: number;
  totalBytes: number;
  totalPcmBytes: number;
  pcmStream?: {
    process: ChildProcessWithoutNullStreams;
    stdin: NodeJS.WritableStream;
    stdout: NodeJS.ReadableStream;
    closing: boolean;
  };
}

@Injectable()
export class AiSpeakingRealtimeService {
  private readonly logger = new Logger(AiSpeakingRealtimeService.name);
  private readonly asrSessions = new Map<string, ActiveAsrSession>();
  private readonly defaultUserAudioMime: string;
  private readonly silenceTimeoutMs: number;
  private readonly silenceWarningThreshold: number;
  private readonly maxBufferedBytes: number;
  private readonly minAudioBytes: number;
  private readonly transcoderCommand: string;
  private readonly asrSampleRate: number;

  constructor(
    @Inject(forwardRef(() => AiSpeakingGateway))
    private readonly gateway: AiSpeakingGateway,
    private readonly ttsService: RealtimeTtsService,
    private readonly asrService: RealtimeAsrService,
    private readonly repository: AiSpeakingRepository,
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
    private readonly turnManager: AiSpeakingTurnManager,
    private readonly profanityDetection: ProfanityDetectionService,
    private readonly profanityBan: ProfanityBanService,
  ) {
    this.defaultUserAudioMime = this.configService.get<string>(
      'AI_SPEAKING_USER_AUDIO_MIME',
      'audio/webm',
    );
    this.silenceTimeoutMs = Number(
      this.configService.get<string>('AI_SPEAKING_SILENCE_TIMEOUT_MS', '6000'),
    );
    this.silenceWarningThreshold = Number(
      this.configService.get<string>(
        'AI_SPEAKING_SILENCE_WARNING_THRESHOLD',
        '2',
      ),
    );
    this.maxBufferedBytes = Number(
      this.configService.get<string>(
        'AI_SPEAKING_MAX_BUFFER_BYTES',
        `${5 * 1024 * 1024}`,
      ),
    );
    this.minAudioBytes = Number(
      this.configService.get<string>('AI_SPEAKING_MIN_AUDIO_BYTES', '4096'),
    );
    this.transcoderCommand = this.configService.get<string>(
      'AI_SPEAKING_TRANSCODER_COMMAND',
      'ffmpeg',
    );
    this.asrSampleRate = Number(
      this.configService.get<string>('AI_SPEAKING_ASR_SAMPLE_RATE', '16000'),
    );
  }

  async streamAiTurn(
    sessionId: string,
    turnId: string,
    text: string,
    options: StreamAiTurnOptions = {},
  ): Promise<void> {
    this.gateway.emitToSession(sessionId, 'ai-speaking:tts-start', {
      turnId,
    });

    try {
      const result = await this.ttsService.synthesizeAndStream({
        sessionId,
        turnId,
        text,
        voiceHint: options.voiceHint,
      });

      const updates: Prisma.AiSpeakingTurnUpdateInput = {
        state: AiSpeakingTurnStatus.waiting_user,
      };

      if (result?.audioUrl) {
        updates.aiAudioUrl = result.audioUrl;
      }

      await this.repository.updateTurn(turnId, updates);

      this.gateway.emitToSession(sessionId, 'ai-speaking:tts-end', {
        turnId,
        audioUrl: result?.audioUrl ?? null,
        text, // ✅ Gửi prompt text để FE hiển thị transcript
      });
    } catch (error) {
      this.logger.error(
        `TTS streaming failed for session=${sessionId} turn=${turnId}: ${error.message}`,
        error as Record<string, unknown>,
      );
      this.gateway.emitToSession(sessionId, 'ai-speaking:tts-error', {
        turnId,
        message: error instanceof Error ? error.message : 'TTS failed',
      });
    }
  }

  async handleUserAudioChunk(params: {
    sessionId: string;
    turnId: string;
    chunkBase64: string;
    sequence?: number;
    mimeType?: string;
  }): Promise<void> {
    const { sessionId, turnId, chunkBase64 } = params;
    const mimeType = params.mimeType ?? this.defaultUserAudioMime;
    const key = this.composeKey(sessionId, turnId);

    if (!this.asrSessions.has(key)) {
      await this.bootstrapAsrSession({ sessionId, turnId, mimeType });
    }

    const holder = this.asrSessions.get(key);
    if (!holder) {
      throw new Error('ASR session could not be initialised');
    }

    const buffer = Buffer.from(chunkBase64, 'base64');
    holder.buffers.push(buffer);
    holder.totalBytes += buffer.length;

    // Debug streaming flow
    this.logger.debug(
      `🎤 Audio chunk received: session=${sessionId} turn=${turnId} chunkSize=${buffer.length} totalSize=${holder.totalBytes}`,
    );

    if (holder.totalBytes > this.maxBufferedBytes) {
      this.logger.warn(
        `Audio buffer overflow for session=${sessionId} turn=${turnId} (${holder.totalBytes} bytes)`,
      );
      this.gateway.emitToSession(sessionId, 'ai-speaking:asr-error', {
        turnId,
        message: 'Luồng ghi âm quá dài, vui lòng thử lại với đoạn ngắn hơn.',
      });
      await this.repository.updateTurn(turnId, {
        state: AiSpeakingTurnStatus.cancelled,
      });
      await this.repository.updateSession(sessionId, {
        state: AiSpeakingSessionState.ai_speaking,
      });
      this.abortUserSpeech(sessionId, turnId);
      return;
    }

    if (!holder.hasTransitionedToUserSpeaking) {
      holder.hasTransitionedToUserSpeaking = true;
      await this.repository.updateTurn(turnId, {
        state: AiSpeakingTurnStatus.waiting_user,
      });
      await this.repository.updateSession(sessionId, {
        state: AiSpeakingSessionState.user_speaking,
        lastActivityAt: new Date(),
      });
      this.gateway.emitToSession(sessionId, 'ai-speaking:user-started', {
        turnId,
      });
    }

    // Initialize PCM transcoder if not yet created
    if (!holder.pcmStream) {
      holder.pcmStream = this.createPcmTranscoder(sessionId, turnId, holder);
    }

    // Write WebM chunk to ffmpeg stdin for PCM conversion
    if (holder.pcmStream && !holder.pcmStream.closing) {
      try {
        holder.pcmStream.stdin.write(buffer);
        this.logger.debug(
          `📤 Wrote ${buffer.length} bytes to ffmpeg: session=${sessionId} turn=${turnId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to write to ffmpeg: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    this.refreshSilenceTimer(sessionId, turnId, holder);
  }

  async finalizeUserSpeech(params: {
    sessionId: string;
    turnId: string;
    durationSec?: number;
  }): Promise<void> {
    const { sessionId, turnId, durationSec } = params;
    const key = this.composeKey(sessionId, turnId);
    const holder = this.asrSessions.get(key);

    if (!holder) {
      this.logger.warn(
        `Finalize requested for session=${sessionId} turn=${turnId} but ASR session not found`,
      );
      return;
    }

    this.clearSilenceTimer(holder);

    // Close ffmpeg stdin to signal end of input
    if (holder.pcmStream && !holder.pcmStream.closing) {
      try {
        holder.pcmStream.stdin.end();
        this.logger.debug(
          `Closed ffmpeg stdin for session=${sessionId} turn=${turnId}`,
        );
      } catch (error) {
        this.logger.warn(
          `Error closing ffmpeg stdin: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    try {
      await holder.handle.finalize();
    } catch (error) {
      this.logger.error(
        `ASR finalize failure for session=${sessionId} turn=${turnId}: ${error instanceof Error ? error.message : error}`,
      );
      this.gateway.emitToSession(sessionId, 'ai-speaking:asr-error', {
        turnId,
        message: error instanceof Error ? error.message : 'ASR finalize failed',
      });
    }

    const audioBuffer = Buffer.concat(holder.buffers);
    let audioUrl: string | null = null;

    if (audioBuffer.length > 0) {
      try {
        const upload = await this.uploadService.uploadBuffer(
          audioBuffer,
          `speaking-${sessionId}-${turnId}.${this.extractExtension(holder.mimeType)}`,
          holder.mimeType,
        );
        audioUrl = upload.url;
      } catch (error) {
        this.logger.error(
          `Failed to upload user audio for session=${sessionId} turn=${turnId}: ${error.message}`,
        );
      }
    }

    const turnUpdates: Prisma.AiSpeakingTurnUpdateInput = {
      state: AiSpeakingTurnStatus.completed,
      userAudioUrl: audioUrl,
      userDurationSec: durationSec ?? null,
      updatedAt: new Date(),
    };

    await this.repository.updateTurn(turnId, turnUpdates);
    await this.repository.updateSession(sessionId, {
      state: AiSpeakingSessionState.evaluating,
      lastActivityAt: new Date(),
    });

    let followUp: Awaited<
      ReturnType<typeof this.turnManager.handleTurnCompletion>
    > | null = null;
    try {
      followUp = await this.turnManager.handleTurnCompletion({
        sessionId,
        turnId,
        audioBuffer,
        mimeType: holder.mimeType,
        durationSec,
      });
    } catch (error) {
      this.logger.error(
        `Failed to process turn completion for session=${sessionId} turn=${turnId}: ${error instanceof Error ? error.message : error}`,
      );
      this.gateway.emitToSession(sessionId, 'ai-speaking:asr-error', {
        turnId,
        message: 'Không thể xử lý kết quả ghi âm, vui lòng thử lại.',
      });
    }

    holder.handle.close();
    this.asrSessions.delete(key);

    this.gateway.emitToSession(sessionId, 'ai-speaking:user-ended', {
      turnId,
      audioUrl,
      durationSec: durationSec ?? null,
    });

    if (followUp?.followUpTurnId && followUp.followUpPrompt) {
      void this.streamAiTurn(
        sessionId,
        followUp.followUpTurnId,
        followUp.followUpPrompt,
        {
          voiceHint: followUp.followUpVoiceHint ?? undefined,
        },
      );
    }
  }

  async abortUserSpeech(sessionId: string, turnId: string): Promise<void> {
    const key = this.composeKey(sessionId, turnId);
    const holder = this.asrSessions.get(key);

    if (!holder) return;

    // Kill ffmpeg process if exists
    if (holder.pcmStream && !holder.pcmStream.closing) {
      try {
        holder.pcmStream.process.kill('SIGTERM');
        this.logger.debug(
          `Killed ffmpeg process for session=${sessionId} turn=${turnId}`,
        );
      } catch (error) {
        this.logger.warn(
          `Error killing ffmpeg: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    holder.handle.close();
    this.clearSilenceTimer(holder);
    this.asrSessions.delete(key);

    await this.repository.updateTurn(turnId, {
      state: AiSpeakingTurnStatus.cancelled,
    });
    await this.repository.updateSession(sessionId, {
      state: AiSpeakingSessionState.ai_speaking,
      lastActivityAt: new Date(),
    });
  }

  private async bootstrapAsrSession(params: {
    sessionId: string;
    turnId: string;
    mimeType: string;
  }): Promise<void> {
    const { sessionId, turnId, mimeType } = params;
    const key = this.composeKey(sessionId, turnId);
    const buffers: Buffer[] = [];

    const handle = await this.asrService.ensureSession({
      sessionId,
      turnId,
      callbacks: {
        onPartial: async (text, confidence) => {
          this.logger.debug(
            `[ASR Partial] sessionId=${sessionId}, turnId=${turnId}, text="${text}", confidence=${confidence}`,
          );

          await this.repository.updateTurn(turnId, {
            userTranscript: text,
            metrics: {
              partial: text,
              partialConfidence: confidence,
              partialUpdatedAt: new Date().toISOString(),
            } as Prisma.JsonObject,
          });

          this.gateway.emitToSession(sessionId, 'ai-speaking:asr-partial', {
            turnId,
            text,
            confidence,
          });
        },
        onFinal: async (payload) => {
          const metrics: Record<string, unknown> = {
            words: payload.words ?? null,
            finalConfidence: payload.confidence ?? null,
            finalizedAt: new Date().toISOString(),
          };

          await this.repository.updateTurn(turnId, {
            userTranscript: payload.text,
            evaluation: (payload.raw as Prisma.JsonObject) ?? null,
            metrics: metrics as Prisma.JsonObject,
          });

          this.gateway.emitToSession(sessionId, 'ai-speaking:asr-final', {
            turnId,
            text: payload.text,
            confidence: payload.confidence ?? null,
            words: payload.words ?? null,
          });

          // ✅ Profanity check
          await this.checkAndHandleProfanity(sessionId, turnId, payload.text);
        },
        onError: (error) => {
          this.gateway.emitToSession(sessionId, 'ai-speaking:asr-error', {
            turnId,
            message: error.message,
          });
        },
      },
    });

    this.asrSessions.set(key, {
      handle,
      buffers,
      mimeType,
      startedAt: Date.now(),
      hasTransitionedToUserSpeaking: false,
      silenceCount: 0,
      totalBytes: 0,
      totalPcmBytes: 0,
      pcmStream: undefined,
    });

    const holder = this.asrSessions.get(key);
    if (holder) {
      this.refreshSilenceTimer(sessionId, turnId, holder);
    }
  }

  private createPcmTranscoder(
    sessionId: string,
    turnId: string,
    holder: ActiveAsrSession,
  ): ActiveAsrSession['pcmStream'] {
    const ffmpeg = spawn(this.transcoderCommand, [
      '-i',
      'pipe:0', // Read from stdin
      '-f',
      's16le', // PCM signed 16-bit little-endian
      '-ar',
      this.asrSampleRate.toString(), // Sample rate 16000
      '-ac',
      '1', // Mono channel
      'pipe:1', // Write to stdout
    ]);

    const pcmStream: ActiveAsrSession['pcmStream'] = {
      process: ffmpeg,
      stdin: ffmpeg.stdin,
      stdout: ffmpeg.stdout,
      closing: false,
    };

    // Pipe PCM output from ffmpeg to ASR WebSocket
    ffmpeg.stdout.on('data', (pcmChunk: Buffer) => {
      holder.totalPcmBytes += pcmChunk.length;
      this.logger.debug(
        `🎵 PCM chunk: ${pcmChunk.length} bytes (total: ${holder.totalPcmBytes})`,
      );
      holder.handle.sendAudioChunk(pcmChunk);
    });

    ffmpeg.stderr.on('data', (data: Buffer) => {
      const message = data.toString();
      if (message.includes('error') || message.includes('Error')) {
        this.logger.warn(`ffmpeg stderr: ${message}`);
      }
    });

    ffmpeg.on('error', (error) => {
      this.logger.error(
        `ffmpeg process error for session=${sessionId} turn=${turnId}: ${error.message}`,
      );
    });

    ffmpeg.on('close', (code) => {
      this.logger.debug(
        `ffmpeg closed for session=${sessionId} turn=${turnId} with code ${code}`,
      );
      if (pcmStream) {
        pcmStream.closing = true;
      }
    });

    return pcmStream;
  }

  private extractExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/mpeg': 'mp3',
    };

    return map[mimeType] ?? 'dat';
  }

  private composeKey(sessionId: string, turnId: string): string {
    return `${sessionId}:${turnId}`;
  }

  private refreshSilenceTimer(
    sessionId: string,
    turnId: string,
    holder: ActiveAsrSession,
  ) {
    this.clearSilenceTimer(holder);
    holder.silenceTimer = setTimeout(() => {
      this.handleSilenceTimeout(sessionId, turnId, holder).catch((error) => {
        this.logger.error(
          `Silence timeout handling failed for session=${sessionId} turn=${turnId}: ${error instanceof Error ? error.message : error}`,
        );
      });
    }, this.silenceTimeoutMs);
  }

  private clearSilenceTimer(holder: ActiveAsrSession) {
    if (holder.silenceTimer) {
      clearTimeout(holder.silenceTimer);
      holder.silenceTimer = undefined;
    }
  }

  private async handleSilenceTimeout(
    sessionId: string,
    turnId: string,
    holder: ActiveAsrSession,
  ) {
    holder.silenceCount += 1;
    this.gateway.emitToSession(sessionId, 'ai-speaking:silence-warning', {
      turnId,
      level: holder.silenceCount,
    });

    await this.repository.updateSession(sessionId, {
      silenceWarnings: { increment: 1 },
      lastActivityAt: new Date(),
    });

    if (
      holder.silenceCount >= this.silenceWarningThreshold &&
      holder.totalBytes === 0
    ) {
      this.logger.warn(
        `Silence threshold reached for session=${sessionId} turn=${turnId}, triggering recovery turn`,
      );
      holder.handle.close();
      this.clearSilenceTimer(holder);
      this.asrSessions.delete(this.composeKey(sessionId, turnId));

      const recovery = await this.turnManager.handleSilence({
        sessionId,
        turnId,
        degradeDifficulty: true,
      });

      if (recovery.followUpTurnId && recovery.followUpPrompt) {
        void this.streamAiTurn(
          sessionId,
          recovery.followUpTurnId,
          recovery.followUpPrompt,
        );
      }
    } else {
      this.refreshSilenceTimer(sessionId, turnId, holder);
    }
  }

  /**
   * Check transcript for profanity and handle violations
   */
  private async checkAndHandleProfanity(
    sessionId: string,
    turnId: string,
    transcript: string,
  ): Promise<void> {
    try {
      // Get session to find userId
      const session = await this.repository.findSessionById(sessionId);
      if (!session) {
        this.logger.warn(`Session ${sessionId} not found for profanity check`);
        return;
      }

      const userId = session.userId;

      // Check for profanity
      const result = await this.profanityDetection.checkText(transcript);

      if (
        result.hasProfanity &&
        this.profanityDetection.shouldCountViolation(result.severity)
      ) {
        this.logger.warn(
          `Profanity detected in session=${sessionId} turn=${turnId} user=${userId} severity=${result.severity}`,
        );

        // Record violation
        const { violationCount, shouldBan } =
          await this.profanityBan.recordViolation(
            userId,
            transcript,
            result.severity,
          );

        // Emit warning to client
        this.gateway.emitToSession(sessionId, 'ai-speaking:profanity-warning', {
          turnId,
          severity: result.severity,
          violationCount,
          maxViolations: 3,
          message: shouldBan
            ? 'Bạn đã vi phạm quy định về ngôn từ quá nhiều lần. Tài khoản bị khóa trong 24 giờ.'
            : `Vui lòng sử dụng ngôn từ phù hợp. Cảnh báo ${violationCount}/3.`,
        });

        // If banned, end session immediately
        if (shouldBan) {
          await this.repository.updateSession(sessionId, {
            state: AiSpeakingSessionState.finished,
            endedAt: new Date(),
            summary: 'Session terminated due to profanity violations.' as any,
          });

          this.gateway.emitToSession(sessionId, 'ai-speaking:session-ended', {
            sessionId,
            reason: 'profanity-ban',
            message: 'Phiên đã bị kết thúc do vi phạm quy định.',
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Profanity check failed for session=${sessionId}: ${error.message}`,
        error.stack,
      );
      // Don't fail the turn on profanity check error
    }
  }
}
