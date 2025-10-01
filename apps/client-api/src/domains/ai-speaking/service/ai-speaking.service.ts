import { PrismaRepository } from '@app/database';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import {
  AiSpeakingSessionState,
  AiSpeakingTurnRole,
  AiSpeakingTurnStatus,
  DifficultyLevel,
  Prisma,
} from '@prisma/client';
import { FinalizeAiSpeakingSessionDto } from '../dto/finalize-session.dto';
import {
  AiSpeakingSessionPresenter,
  AiSpeakingSessionResponseDto,
} from '../dto/session-response.dto';
import { StartAiSpeakingSessionDto } from '../dto/start-session.dto';
import { AiSpeakingRepository } from '../repository/ai-speaking.repository';
import { AiSpeakingCoordinator } from './ai-speaking-coordinator.service';
import { AiSpeakingRealtimeService } from './ai-speaking-realtime.service';
import { ConversationDesignerService } from './conversation-designer.service';

@Injectable()
export class AiSpeakingService {
  private readonly logger = new Logger(AiSpeakingService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly repository: AiSpeakingRepository,
    private readonly coordinator: AiSpeakingCoordinator,
    private readonly realtimeService: AiSpeakingRealtimeService,
    private readonly conversationDesigner: ConversationDesignerService,
  ) {}

  async startSession(userId: string, dto: StartAiSpeakingSessionDto) {
    // Generate conversationId if not provided
    const conversationId = dto.conversationId || this.generateConversationId();

    const targetDifficulty = dto.targetDifficulty ?? DifficultyLevel.beginner;
    const maxTurns = dto.maxTurns ?? 8;

    const openingPlan = this.conversationDesigner.buildOpeningPrompt({
      topic: dto.topic,
      difficulty: targetDifficulty,
    });

    const { session, openingTurnId } = await this.prisma.$transaction(async (tx) => {
      const createdSession = await this.repository.createSession(
        {
          user: { connect: { id: userId } },
          conversationId,
          topic: dto.topic,
          goal: dto.goal,
          state: AiSpeakingSessionState.pending,
          maxTurns,
          turnCount: 0,
          targetDifficulty,
          currentDifficulty: targetDifficulty,
          config: (dto.config as Prisma.JsonObject) ?? {},
          metadata: openingPlan.metadata as Prisma.JsonObject,
        },
        tx,
      );

      const turn = await this.repository.createTurn(
        {
          session: { connect: { id: createdSession.id } },
          turnIndex: 1,
          state: AiSpeakingTurnStatus.streaming,
          aiPrompt: openingPlan.prompt,
          suggestions: openingPlan.followUpSuggestions,
        },
        tx,
      );

      await this.repository.createTurnSegment(
        {
          turn: { connect: { id: turn.id } },
          role: AiSpeakingTurnRole.system,
          orderNo: 0,
          transcript: 'Session initialized',
          payload: {
            designerVersion: openingPlan.version,
          } as Prisma.JsonObject,
        },
        tx,
      );

      await this.repository.createTurnSegment(
        {
          turn: { connect: { id: turn.id } },
          role: AiSpeakingTurnRole.ai,
          orderNo: 1,
          transcript: openingPlan.prompt,
          payload: {
            topic: dto.topic,
            difficulty: targetDifficulty,
          } as Prisma.JsonObject,
        },
        tx,
      );

      const updatedSession = await this.repository.updateSession(
        createdSession.id,
        {
          state: AiSpeakingSessionState.ai_speaking,
          turnCount: 1,
          lastActivityAt: new Date(),
        },
        tx,
      );

      return { session: updatedSession, openingTurnId: turn.id };
    });

    void this.realtimeService.streamAiTurn(
      session.id,
      openingTurnId,
      openingPlan.prompt,
      {
        voiceHint: openingPlan.metadata?.voice as string | undefined,
      },
    );

    const sessionWithRelations = await this.repository.findSessionById(session.id);
    return AiSpeakingSessionPresenter.toDto(sessionWithRelations);
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.repository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException('Session không tồn tại');
    }
    this.ensureSessionOwner(userId, session.userId);

    return AiSpeakingSessionPresenter.toDto(session);
  }

  async listSessions(
    userId: string,
    options: { limit?: number; cursor?: string } = {},
  ) {
    const sessions = await this.repository.listSessionsByUser(userId, options);
    return sessions
      .map((session) => AiSpeakingSessionPresenter.toDto(session))
      .filter((value): value is AiSpeakingSessionResponseDto => !!value);
  }

  async finalizeSession(
    userId: string,
    sessionId: string,
    dto: FinalizeAiSpeakingSessionDto,
  ) {
    const session = await this.repository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException('Session không tồn tại');
    }
    this.ensureSessionOwner(userId, session.userId);

    if (
      session.state === AiSpeakingSessionState.finished ||
      session.state === AiSpeakingSessionState.aborted
    ) {
      return AiSpeakingSessionPresenter.toDto(session);
    }

    const summary = await this.coordinator.summarizeSession(session, dto);

    const updated = await this.repository.updateSession(session.id, {
      state: AiSpeakingSessionState.finished,
      summary: summary.summaryText,
      summaryPayload: summary.payload as Prisma.JsonObject,
      analytics: summary.analytics as Prisma.JsonObject,
      endedAt: new Date(),
      lastActivityAt: new Date(),
    });

    return AiSpeakingSessionPresenter.toDto(updated);
  }

  private ensureSessionOwner(userId: string, ownerId: string) {
    if (userId !== ownerId) {
      throw new ForbiddenException('Bạn không có quyền truy cập session này');
    }
  }

  async listConversations(
    userId: string,
    options: { limit?: number; cursor?: string } = {},
  ) {
    const conversations = await this.repository.listConversationsByUser(userId, options);
    return conversations.map((conv) => ({
      conversationId: conv.conversationId,
      latestSession: AiSpeakingSessionPresenter.toDto(conv.latestSession),
      sessionCount: conv.sessionCount,
    }));
  }

  async getConversation(userId: string, conversationId: string) {
    const sessions = await this.repository.findSessionsByConversation(userId, conversationId);
    if (sessions.length === 0) {
      throw new NotFoundException('Conversation không tồn tại');
    }

    return {
      conversationId,
      sessions: sessions
        .map((session) => AiSpeakingSessionPresenter.toDto(session))
        .filter((value): value is AiSpeakingSessionResponseDto => !!value),
    };
  }

  private generateConversationId(): string {
    // Generate a conversation ID based on timestamp and random
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8);
    return `conv_${timestamp}_${random}`;
  }
}
