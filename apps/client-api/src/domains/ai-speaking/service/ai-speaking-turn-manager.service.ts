import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiSpeakingSessionState,
  AiSpeakingTurnRole,
  AiSpeakingTurnStatus,
  DifficultyLevel,
  Prisma,
} from '@prisma/client';
import { GeminiService } from '@app/shared';
import { AiSpeakingRepository } from '../repository/ai-speaking.repository';
import { ConversationDesignerService } from './conversation-designer.service';
import { PronunciationAssessmentService } from './pronunciation-assessment.service';
import { AiSpeakingGateway } from '../gateway/ai-speaking.gateway';
import { AiSpeakingCoordinator } from './ai-speaking-coordinator.service';

const DIFFICULTY_ORDER: DifficultyLevel[] = [
  DifficultyLevel.beginner,
  DifficultyLevel.elementary,
  DifficultyLevel.intermediate,
  DifficultyLevel.upper_intermediate,
  DifficultyLevel.advanced,
  DifficultyLevel.expert,
];

interface TurnCompletionResult {
  followUpTurnId?: string;
  followUpPrompt?: string;
  followUpVoiceHint?: string | null;
  sessionFinished?: boolean;
  evaluation: Record<string, unknown>;
}

interface SilenceRecoveryResult {
  followUpTurnId?: string;
  followUpPrompt?: string;
}

@Injectable()
export class AiSpeakingTurnManager {
  private readonly logger = new Logger(AiSpeakingTurnManager.name);
  private readonly maxAutoTurns: number;

  constructor(
    private readonly repository: AiSpeakingRepository,
    private readonly geminiService: GeminiService,
    private readonly conversationDesigner: ConversationDesignerService,
    private readonly pronunciationService: PronunciationAssessmentService,
    private readonly gateway: AiSpeakingGateway,
    private readonly coordinator: AiSpeakingCoordinator,
    private readonly configService: ConfigService,
  ) {
    this.maxAutoTurns = Number(
      this.configService.get<string>('AI_SPEAKING_MAX_FOLLOWUP_TURNS', '12'),
    );
  }

  async handleTurnCompletion(params: {
    sessionId: string;
    turnId: string;
    audioBuffer: Buffer;
    mimeType: string;
    durationSec?: number;
  }): Promise<TurnCompletionResult> {
    const { sessionId, turnId, audioBuffer, mimeType, durationSec } = params;
    const session = await this.repository.findSessionById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const turn = session.turns.find((t) => t.id === turnId);
    if (!turn) {
      throw new Error(`Turn ${turnId} not found in session ${sessionId}`);
    }

    const audioBase64 = audioBuffer.toString('base64');

    const evaluation = await this.geminiService.evaluateSpeaking({
      audioBase64,
      mimeType,
      prompt: session.goal ?? session.topic ?? 'Free speaking practice',
      minSeconds: turn.userDurationSec ?? durationSec ?? 0,
    });

    const suggestions = Array.isArray(evaluation.detail?.suggestedPhrases)
      ? (evaluation.detail?.suggestedPhrases as string[])
      : [];

    // ✅ Pronunciation assessment với Google Cloud Speech-to-Text
    let pronunciationFeedback: Awaited<ReturnType<typeof this.pronunciationService.assessPronunciation>> | null = null;
    try {
      const referenceText = evaluation.transcript || turn.userTranscript || undefined;
      pronunciationFeedback = await this.pronunciationService.assessPronunciation(
        audioBuffer,
        referenceText,
        'en-US',
      );

      this.logger.log(
        `Pronunciation assessed for turn ${turnId}: overall=${pronunciationFeedback.pronunciationScore}, ` +
        `accuracy=${pronunciationFeedback.accuracyScore}, fluency=${pronunciationFeedback.fluencyScore}, ` +
        `problematic=[${pronunciationFeedback.problematicPhonemes.join(', ')}]`,
      );

      // Emit pronunciation feedback to frontend
      this.gateway.emitToSession(sessionId, 'ai-speaking:pronunciation-feedback', {
        turnId,
        pronunciationFeedback,
      });
    } catch (error) {
      this.logger.warn(
        `Pronunciation assessment failed for turn ${turnId}: ${error.message}. Continuing without phoneme feedback.`,
      );
      // Don't block flow if pronunciation fails
    }

    const metrics: Prisma.JsonObject = {
      ...(typeof turn.metrics === 'object' && turn.metrics
        ? (turn.metrics as any)
        : {}),
      evaluationScore: evaluation.score,
      evaluationCreatedAt: new Date().toISOString(),
      durationSec: durationSec ?? null,
      pronunciationScore: pronunciationFeedback?.pronunciationScore ?? null,
      accuracyScore: pronunciationFeedback?.accuracyScore ?? null,
      fluencyScore: pronunciationFeedback?.fluencyScore ?? null,
    };

    const transcript = evaluation.transcript || turn.userTranscript || null;

    const updatedTurn = await this.repository.updateTurn(turnId, {
      score: evaluation.score,
      evaluation: evaluation as unknown as Prisma.JsonObject,
      suggestions,
      userTranscript: transcript,
      metrics,
      pronunciationFeedback: pronunciationFeedback as unknown as Prisma.JsonObject ?? null,
    });

    this.gateway.emitToSession(sessionId, 'ai-speaking:turn-evaluated', {
      turnId,
      evaluation,
    });

    const nextDifficulty = this.adjustDifficulty(
      session.currentDifficulty ?? session.targetDifficulty,
      evaluation.score,
    );

    const reachedTurnLimit =
      session.turnCount >= session.maxTurns ||
      session.turnCount >= this.maxAutoTurns;
    const shouldContinue = !reachedTurnLimit && evaluation.score >= 25;

    if (!shouldContinue) {
      const sessionForSummary =
        await this.repository.findSessionById(sessionId);
      if (!sessionForSummary) {
        throw new Error(`Session ${sessionId} not found for summarization`);
      }

      const summary = await this.coordinator.summarizeSession(
        sessionForSummary,
        {
          reason: reachedTurnLimit
            ? 'Kết thúc do đạt giới hạn lượt hội thoại.'
            : 'Kết thúc do điểm số thấp.',
        },
      );

      await this.repository.updateSession(sessionId, {
        state: AiSpeakingSessionState.finished,
        summary: summary.summaryText,
        summaryPayload: summary.payload as Prisma.JsonObject,
        analytics: summary.analytics as Prisma.JsonObject,
        endedAt: new Date(),
        lastActivityAt: new Date(),
      });

      this.gateway.emitToSession(sessionId, 'ai-speaking:session-finished', {
        sessionId,
        summary: summary.summaryText,
        analytics: summary.analytics,
      });

      return { sessionFinished: true, evaluation };
    }

    const nextTurnIndex = session.turnCount + 1;
    const prompt = await this.buildFollowUpPrompt({
      sessionTopic: session.topic,
      goal: session.goal,
      transcript: transcript ?? '',
      evaluation,
      difficulty: nextDifficulty,
    });

    const nextTurn = await this.repository.createTurn({
      session: { connect: { id: sessionId } },
      turnIndex: nextTurnIndex,
      state: AiSpeakingTurnStatus.streaming,
      aiPrompt: prompt,
      suggestions,
    });

    await this.repository.createTurnSegment({
      turn: { connect: { id: nextTurn.id } },
      role: AiSpeakingTurnRole.ai,
      orderNo: 0,
      transcript: prompt,
      payload: {
        followUpForTurn: updatedTurn.turnIndex,
      } as Prisma.JsonObject,
    });

    await this.repository.updateSession(sessionId, {
      state: AiSpeakingSessionState.ai_speaking,
      turnCount: nextTurnIndex,
      currentDifficulty: nextDifficulty,
      lastActivityAt: new Date(),
    });

    this.gateway.emitToSession(sessionId, 'ai-speaking:next-turn', {
      sessionId,
      turnId: nextTurn.id,
      prompt,
      difficulty: nextDifficulty,
    });

    return {
      followUpTurnId: nextTurn.id,
      followUpPrompt: prompt,
      followUpVoiceHint: null,
      evaluation,
    };
  }

  async handleSilence(params: {
    sessionId: string;
    turnId: string;
    degradeDifficulty: boolean;
  }): Promise<SilenceRecoveryResult> {
    const { sessionId, turnId, degradeDifficulty } = params;
    const session = await this.repository.findSessionById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const turn = session.turns.find((t) => t.id === turnId);
    if (!turn) {
      throw new Error(`Turn ${turnId} not found in session ${sessionId}`);
    }

    await this.repository.updateTurn(turnId, {
      state: AiSpeakingTurnStatus.cancelled,
      silenceDetected: true,
    });

    const nextDifficulty = degradeDifficulty
      ? this.stepDifficultyDown(
          session.currentDifficulty ?? session.targetDifficulty,
        )
      : (session.currentDifficulty ?? session.targetDifficulty);

    const promptPlan = this.conversationDesigner.buildOpeningPrompt({
      topic: session.topic,
      difficulty: nextDifficulty,
    });

    const nextTurnIndex = session.turnCount + 1;
    const nextTurn = await this.repository.createTurn({
      session: { connect: { id: sessionId } },
      turnIndex: nextTurnIndex,
      state: AiSpeakingTurnStatus.streaming,
      aiPrompt: promptPlan.prompt,
      suggestions: promptPlan.followUpSuggestions,
    });

    await this.repository.createTurnSegment({
      turn: { connect: { id: nextTurn.id } },
      role: AiSpeakingTurnRole.ai,
      orderNo: 0,
      transcript: promptPlan.prompt,
      payload: {
        reason: 'silence-recovery',
      } as Prisma.JsonObject,
    });

    await this.repository.updateSession(sessionId, {
      turnCount: nextTurnIndex,
      currentDifficulty: nextDifficulty,
      state: AiSpeakingSessionState.ai_speaking,
      lastActivityAt: new Date(),
      silenceWarnings: { increment: 1 },
    });

    this.gateway.emitToSession(sessionId, 'ai-speaking:next-turn', {
      sessionId,
      turnId: nextTurn.id,
      prompt: promptPlan.prompt,
      difficulty: nextDifficulty,
    });

    return { followUpTurnId: nextTurn.id, followUpPrompt: promptPlan.prompt };
  }

  private adjustDifficulty(
    current: DifficultyLevel,
    score: number,
  ): DifficultyLevel {
    if (score >= 85) {
      return this.stepDifficultyUp(current);
    }

    if (score <= 45) {
      return this.stepDifficultyDown(current);
    }

    return current;
  }

  private stepDifficultyUp(level: DifficultyLevel): DifficultyLevel {
    const idx = DIFFICULTY_ORDER.indexOf(level);
    if (idx === -1 || idx === DIFFICULTY_ORDER.length - 1) return level;
    return DIFFICULTY_ORDER[idx + 1];
  }

  private stepDifficultyDown(level: DifficultyLevel): DifficultyLevel {
    const idx = DIFFICULTY_ORDER.indexOf(level);
    if (idx <= 0) return DIFFICULTY_ORDER[0];
    return DIFFICULTY_ORDER[idx - 1];
  }

  private async buildFollowUpPrompt(params: {
    sessionTopic?: string | null;
    goal?: string | null;
    transcript: string;
    evaluation: Record<string, any>;
    difficulty: DifficultyLevel;
  }): Promise<string> {
    const { sessionTopic, goal, transcript, evaluation, difficulty } = params;
    const contextParts: string[] = [];
    if (sessionTopic) {
      contextParts.push(`Topic: ${sessionTopic}`);
    }
    if (goal) {
      contextParts.push(`Goal: ${goal}`);
    }

    const prompt = `Bạn là trợ giảng tiếng Anh thân thiện. Đây là câu trả lời gần nhất của học viên:
"${transcript}".
Điểm tạm đánh giá: ${evaluation?.score ?? 'không có'}.
${contextParts.join('\n')}

Hãy phản hồi trong tối đa 70 từ bằng tiếng Anh đơn giản phù hợp trình độ ${difficulty.replace('_', ' ')}.
- Ghi nhận điểm mạnh hoặc nội dung thú vị.
- Chỉ gợi ý một cải thiện nhỏ.
- Đặt một câu hỏi tiếp theo để học viên nói tiếp.
Trả về văn bản thuần không cần định dạng.`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      return response.trim();
    } catch (error) {
      this.logger.warn(
        `Gemini generate follow-up failed: ${(error as Error).message}. Fallback to template`,
      );
      return this.conversationDesigner.buildOpeningPrompt({
        topic: sessionTopic ?? 'daily life',
        difficulty,
      }).prompt;
    }
  }
}
