import { GeminiService } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiSpeakingSessionState,
  AiSpeakingTurnRole,
  AiSpeakingTurnStatus,
  DifficultyLevel,
  Prisma,
} from '@prisma/client';
import { AiSpeakingGateway } from '../gateway/ai-speaking.gateway';
import { AiSpeakingRepository } from '../repository/ai-speaking.repository';
import { AiSpeakingCoordinator } from './ai-speaking-coordinator.service';
import { ConversationDesignerService } from './conversation-designer.service';
import { SuggestionService } from './suggestion.service';
import {
  calculateNormalizedScore,
  getDifficultyMultiplier,
  getNextDifficulty,
  shouldAdjustDifficulty,
} from './difficulty-scoring.util';
import { MispronunciationService } from './mispronunciation.service';
import { PronunciationAssessmentService } from './pronunciation-assessment.service';

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
    private readonly mispronunciationService: MispronunciationService,
    private readonly gateway: AiSpeakingGateway,
    private readonly coordinator: AiSpeakingCoordinator,
    private readonly configService: ConfigService,
    private readonly suggestionService: SuggestionService,
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

    // PERFORMANCE: Run Gemini evaluation and Pronunciation assessment in PARALLEL
    const [evaluation, pronunciationFeedback] = await Promise.all([
      // Gemini evaluation
      this.geminiService.evaluateSpeaking({
        audioBase64,
        mimeType,
        prompt: session.goal ?? session.topic ?? 'Free speaking practice',
      }),
      // Pronunciation assessment (no need to wait for transcript)
      this.pronunciationService
        .assessPronunciation(audioBuffer, undefined, 'en-US', mimeType)
        .catch((error) => {
          this.logger.warn(
            `Pronunciation assessment failed for turn ${turnId}: ${error.message}. Continuing without phoneme feedback.`,
          );
          return null;
        }),
    ]);

    // We don't need old suggestions anymore
    const suggestions: string[] = [];

    // Emit pronunciation feedback to frontend if available
    if (pronunciationFeedback) {
      this.logger.log(
        `Pronunciation assessed for turn ${turnId}: overall=${pronunciationFeedback.pronunciationScore}, ` +
        `accuracy=${pronunciationFeedback.accuracyScore}, fluency=${pronunciationFeedback.fluencyScore}, ` +
        `problematic=[${pronunciationFeedback.problematicPhonemes.join(', ')}]`,
      );
      this.gateway.emitToSession(
        sessionId,
        'ai-speaking:pronunciation-feedback',
        {
          turnId,
          pronunciationFeedback,
        },
      );

      // LOG MISPRONUNCIATIONS
      // Iterate through words to find specific errors (< 70 accuracy)
      if (pronunciationFeedback.words) {
        for (const wordInfo of pronunciationFeedback.words) {
          if (wordInfo.accuracyScore < 70) {
            // Find problematic phonemes for this specific word if possible, or just log the word
            // The service will handle deduplication and counting
            this.mispronunciationService.logError({
              userId: session.userId,
              word: wordInfo.word,
              phoneme: wordInfo.phonemes?.find(p => p.accuracyScore < 60)?.phoneme, // heuristic
              contextSentence: pronunciationFeedback.transcript,
              source: 'ai_speaking_session',
              userPronunciation: '', // Not available directly yet
            }).catch(e => {
              console.log("Error", e)
            })
          }
        }
      }
    }

    // NEW: Apply difficulty-weighted scoring
    const currentDifficulty =
      session.currentDifficulty ?? session.targetDifficulty;
    const rawScore = evaluation.score;
    const { normalizedScore, newDifficulty } = this.processScore(
      rawScore,
      currentDifficulty,
    );

    const metrics: Prisma.JsonObject = {
      ...(typeof turn.metrics === 'object' && turn.metrics
        ? (turn.metrics as any)
        : {}),
      evaluationScore: evaluation.score,
      rawScore, // Store original score
      normalizedScore, // Store difficulty-adjusted score
      difficultyMultiplier: getDifficultyMultiplier(currentDifficulty),
      evaluationCreatedAt: new Date().toISOString(),
      durationSec: durationSec ?? null,
      pronunciationScore: pronunciationFeedback?.pronunciationScore ?? null,
      accuracyScore: pronunciationFeedback?.accuracyScore ?? null,
      fluencyScore: pronunciationFeedback?.fluencyScore ?? null,
    };

    const transcript = evaluation.transcript || turn.userTranscript || null;

    const updatedTurn = await this.repository.updateTurn(turnId, {
      score: normalizedScore, // Use normalized score for display
      evaluation: evaluation as unknown as Prisma.JsonObject,
      suggestions,
      userTranscript: transcript,
      metrics,
      pronunciationFeedback:
        (pronunciationFeedback as unknown as Prisma.JsonObject) ?? null,
    });

    this.gateway.emitToSession(sessionId, 'ai-speaking:turn-evaluated', {
      turnId,
      evaluation,
    });

    const nextDifficulty = newDifficulty;

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

    // GENERATE PROMPT + SUGGESTIONS IN ONE CALL
    const promptPlan = await this.buildFollowUpPrompt({
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
      aiPrompt: promptPlan.prompt,
      suggestions: promptPlan.suggestions,
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
      suggestions: nextTurn.suggestions, // SEND SUGGESTIONS TO FRONTEND
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

    const currentDifficulty =
      session.currentDifficulty ?? session.targetDifficulty;
    const nextDifficulty = degradeDifficulty
      ? getNextDifficulty(currentDifficulty, 'down')
      : currentDifficulty;

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
      suggestions: nextTurn.suggestions, // SEND SUGGESTIONS TO FRONTEND
    });

    return { followUpTurnId: nextTurn.id, followUpPrompt: promptPlan.prompt };
  }

  /**
   * NEW: Difficulty-weighted scoring with normalized score calculation.
   * Applies difficulty multipliers and determines next difficulty level.
   */
  private processScore(
    rawScore: number,
    currentDifficulty: DifficultyLevel,
  ): { normalizedScore: number; newDifficulty: DifficultyLevel } {
    const { normalizedScore, multiplier } = calculateNormalizedScore(
      rawScore,
      currentDifficulty,
    );

    this.logger.log(
      `Score calculation: raw=${rawScore}, multiplier=${multiplier}, normalized=${normalizedScore}, difficulty=${currentDifficulty}`,
    );

    const adjustment = shouldAdjustDifficulty(
      normalizedScore,
      currentDifficulty,
    );
    const newDifficulty =
      adjustment === 'none'
        ? currentDifficulty
        : getNextDifficulty(currentDifficulty, adjustment);

    if (newDifficulty !== currentDifficulty) {
      this.logger.log(
        `Difficulty adjustment: ${currentDifficulty} → ${newDifficulty} (score=${normalizedScore}, threshold=${adjustment})`,
      );
    }

    return { normalizedScore, newDifficulty };
  }

  /*
   * OLD_adjustDifficulty_backup - Commented for backwards reference
   * This method used fixed thresholds (85/45) regardless of difficulty level.
   * Replaced by processScore() which uses difficulty-weighted scoring.
   *
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
  */

  private async buildFollowUpPrompt(params: {
    sessionTopic?: string | null;
    goal?: string | null;
    transcript: string;
    evaluation: Record<string, any>;
    difficulty: DifficultyLevel;
  }): Promise<{ prompt: string; suggestions: string[] }> {
    const { sessionTopic, goal, transcript, evaluation, difficulty } = params;
    const contextParts: string[] = [];
    if (sessionTopic) {
      contextParts.push(`Topic: ${sessionTopic}`);
    }
    if (goal) {
      contextParts.push(`Goal: ${goal}`);
    }

    const prompt = `You are a friendly English Tutor.
Context:
- User's last response: "${transcript}"
- Evaluation score: ${evaluation?.score ?? 'N/A'}
- ${contextParts.join('\n')}
- Current Level: ${difficulty.replace('_', ' ')}

Task:
1. Generate a short, encouraging follow-up response (max 40 words) that includes a question to keep the conversation going.
2. Generate 3 short, natural sample replies (suggestions) that the user could say to answer your new question.

Output Requirement:
Return ONLY a valid JSON object:
{
  "prompt": "Your follow-up response and question here",
  "suggestions": ["Option 1", "Option 2", "Option 3"]
}`;

    try {
      const result = await this.geminiService.generateJSONResponse(prompt);
      const parsed = JSON.parse(result);

      return {
        prompt: parsed.prompt || result,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch (error) {
      this.logger.warn(
        `Gemini generate follow-up failed: ${(error as Error).message}. Fallback to template`,
      );
      // Fallback
      const fallback = this.conversationDesigner.buildOpeningPrompt({
        topic: sessionTopic ?? 'daily life',
        difficulty,
      });
      return {
        prompt: fallback.prompt,
        suggestions: [], // Empty suggestions on fallback to avoid blocking
      };
    }
  }
}
