import {
  AiSpeakingSession,
  AiSpeakingTurn,
  AiSpeakingTurnRole,
  AiSpeakingTurnSegment,
  AiSpeakingTurnStatus,
  AiSpeakingSessionState,
  DifficultyLevel,
} from '@prisma/client';

export interface AiSpeakingTurnSegmentDto {
  id: string;
  role: AiSpeakingTurnRole;
  orderNo: number;
  transcript?: string | null;
  audioUrl?: string | null;
  durationSec?: number | null;
  payload?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AiSpeakingTurnDto {
  id: string;
  turnIndex: number;
  state: AiSpeakingTurnStatus;
  aiPrompt?: string | null;
  aiAudioUrl?: string | null;
  userTranscript?: string | null;
  userAudioUrl?: string | null;
  userDurationSec?: number | null;
  metrics?: Record<string, unknown> | null;
  evaluation?: Record<string, unknown> | null;
  suggestions: string[];
  score?: number | null;
  relevanceScore?: number | null;
  silenceDetected: boolean;
  createdAt: Date;
  updatedAt: Date;
  segments: AiSpeakingTurnSegmentDto[];
}

export interface AiSpeakingSessionResponseDto {
  id: string;
  userId: string;
  topic?: string | null;
  goal?: string | null;
  state: AiSpeakingSessionState;
  maxTurns: number;
  turnCount: number;
  targetDifficulty: DifficultyLevel;
  currentDifficulty?: DifficultyLevel | null;
  silenceWarnings: number;
  offTopicWarnings: number;
  config?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  analytics?: Record<string, unknown> | null;
  summary?: string | null;
  summaryPayload?: Record<string, unknown> | null;
  startedAt: Date;
  lastActivityAt: Date;
  endedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  turns: AiSpeakingTurnDto[];
}

export const AiSpeakingSessionPresenter = {
  toDto(
    session:
      | (AiSpeakingSession & {
          turns: Array<AiSpeakingTurn & { segments: AiSpeakingTurnSegment[] }>;
        })
      | null,
  ): AiSpeakingSessionResponseDto | null {
    if (!session) return null;

    const sortedTurns = [...session.turns].sort(
      (a, b) => a.turnIndex - b.turnIndex,
    );

    return {
      id: session.id,
      userId: session.userId,
      topic: session.topic,
      goal: session.goal,
      state: session.state,
      maxTurns: session.maxTurns,
      turnCount: session.turnCount,
      targetDifficulty: session.targetDifficulty,
      currentDifficulty: session.currentDifficulty,
      silenceWarnings: session.silenceWarnings,
      offTopicWarnings: session.offTopicWarnings,
      config: (session.config as any) ?? null,
      metadata: (session.metadata as any) ?? null,
      analytics: (session.analytics as any) ?? null,
      summary: session.summary,
      summaryPayload: (session.summaryPayload as any) ?? null,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
      endedAt: session.endedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      turns: sortedTurns.map((turn) => ({
        id: turn.id,
        turnIndex: turn.turnIndex,
        state: turn.state,
        aiPrompt: turn.aiPrompt,
        aiAudioUrl: turn.aiAudioUrl,
        userTranscript: turn.userTranscript,
        userAudioUrl: turn.userAudioUrl,
        userDurationSec: turn.userDurationSec,
        metrics: (turn.metrics as any) ?? null,
        evaluation: (turn.evaluation as any) ?? null,
        suggestions: turn.suggestions ?? [],
        score: turn.score,
        relevanceScore: turn.relevanceScore,
        silenceDetected: turn.silenceDetected,
        createdAt: turn.createdAt,
        updatedAt: turn.updatedAt,
        segments: [...turn.segments]
          .sort((a, b) => a.orderNo - b.orderNo)
          .map((segment) => ({
            id: segment.id,
            role: segment.role,
            orderNo: segment.orderNo,
            transcript: segment.transcript,
            audioUrl: segment.audioUrl,
            durationSec: segment.durationSec,
            payload: (segment.payload as any) ?? null,
            createdAt: segment.createdAt,
          })),
      })),
    };
  },
};
