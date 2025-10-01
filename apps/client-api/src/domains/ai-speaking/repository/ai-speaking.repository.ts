import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { AiSpeakingSessionState, Prisma } from '@prisma/client';

export type AiSpeakingSessionWithRelations =
  Prisma.AiSpeakingSessionGetPayload<{
    include: {
      turns: {
        include: {
          segments: true;
        };
      };
    };
  }>;

@Injectable()
export class AiSpeakingRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  private readonly sessionInclude = {
    turns: {
      include: {
        segments: true,
      },
    },
  } satisfies Prisma.AiSpeakingSessionInclude;

  private resolveClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  async findSessionById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AiSpeakingSessionWithRelations | null> {
    const client = this.resolveClient(tx);
    return client.aiSpeakingSession.findUnique({
      where: { id },
      include: this.sessionInclude,
    });
  }

  async findActiveSessionByUser(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AiSpeakingSessionWithRelations | null> {
    const client = this.resolveClient(tx);
    return client.aiSpeakingSession.findFirst({
      where: {
        userId,
        state: {
          in: [
            AiSpeakingSessionState.pending,
            AiSpeakingSessionState.ai_speaking,
            AiSpeakingSessionState.user_speaking,
            AiSpeakingSessionState.evaluating,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: this.sessionInclude,
    });
  }

  async listSessionsByUser(
    userId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<AiSpeakingSessionWithRelations[]> {
    const { limit = 20, cursor } = options;
    return this.prisma.aiSpeakingSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: cursor ? 1 : undefined,
      cursor: cursor ? { id: cursor } : undefined,
      include: this.sessionInclude,
    });
  }

  async createSession(
    data: Prisma.AiSpeakingSessionCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<AiSpeakingSessionWithRelations> {
    const client = this.resolveClient(tx);
    const session = await client.aiSpeakingSession.create({
      data,
      include: this.sessionInclude,
    });
    return session;
  }

  async updateSession(
    id: string,
    data: Prisma.AiSpeakingSessionUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<AiSpeakingSessionWithRelations> {
    const client = this.resolveClient(tx);
    return client.aiSpeakingSession.update({
      where: { id },
      data,
      include: this.sessionInclude,
    });
  }

  async createTurn(
    data: Prisma.AiSpeakingTurnCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.resolveClient(tx);
    return client.aiSpeakingTurn.create({
      data,
      include: { segments: true },
    });
  }

  async updateTurn(
    id: string,
    data: Prisma.AiSpeakingTurnUpdateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.resolveClient(tx);
    return client.aiSpeakingTurn.update({
      where: { id },
      data,
      include: { segments: true },
    });
  }

  async createTurnSegment(
    data: Prisma.AiSpeakingTurnSegmentCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.resolveClient(tx);
    return client.aiSpeakingTurnSegment.create({ data });
  }

  async findSessionsByConversation(
    userId: string,
    conversationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AiSpeakingSessionWithRelations[]> {
    const client = this.resolveClient(tx);
    return client.aiSpeakingSession.findMany({
      where: {
        userId,
        conversationId,
      },
      orderBy: { createdAt: 'asc' },
      include: this.sessionInclude,
    });
  }

  async listConversationsByUser(
    userId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<
    {
      conversationId: string;
      latestSession: AiSpeakingSessionWithRelations;
      sessionCount: number;
    }[]
  > {
    const { limit = 20, cursor } = options;

    // Get distinct conversation IDs first
    const distinctConversations = await this.prisma.aiSpeakingSession.findMany({
      where: { userId },
      select: { conversationId: true },
      distinct: ['conversationId'],
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const result = [];
    for (const conv of distinctConversations) {
      // Get latest session
      const latestSession = await this.prisma.aiSpeakingSession.findFirst({
        where: {
          userId,
          conversationId: conv.conversationId,
        },
        orderBy: { createdAt: 'desc' },
        include: this.sessionInclude,
      });

      // Count total sessions in conversation
      const sessionCount = await this.prisma.aiSpeakingSession.count({
        where: {
          userId,
          conversationId: conv.conversationId,
        },
      });

      if (latestSession) {
        result.push({
          conversationId: conv.conversationId,
          latestSession,
          sessionCount,
        });
      }
    }

    return result;
  }
}
