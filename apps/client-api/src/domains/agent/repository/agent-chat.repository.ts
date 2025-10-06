import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { AgentConversation, AgentMessage, Prisma } from '@prisma/client';

export interface CreateAgentConversationDto {
  userId: string;
  role?: string;
  title?: string;
  metadata?: any;
}

export interface CreateAgentMessageDto {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
}

export interface AgentConversationWithMessages extends AgentConversation {
  messages: AgentMessage[];
}

@Injectable()
export class AgentChatRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async createConversation(
    data: CreateAgentConversationDto,
  ): Promise<AgentConversation> {
    return this.prisma.agentConversation.create({
      data: {
        userId: data.userId,
        role: data.role || 'student',
        title: data.title,
        metadata: data.metadata as Prisma.JsonObject,
      },
    });
  }

  async findConversationById(
    id: string,
  ): Promise<AgentConversationWithMessages | null> {
    return this.prisma.agentConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findUserConversations(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<AgentConversation[]> {
    const { limit = 20, offset = 0 } = options;
    return this.prisma.agentConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async createMessage(data: CreateAgentMessageDto): Promise<AgentMessage> {
    return this.prisma.agentMessage.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        metadata: data.metadata as Prisma.JsonObject,
      },
    });
  }

  async getConversationMessages(
    conversationId: string,
    limit?: number,
  ): Promise<AgentMessage[]> {
    return this.prisma.agentMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async updateConversation(
    id: string,
    data: Prisma.AgentConversationUpdateInput,
  ): Promise<AgentConversation> {
    return this.prisma.agentConversation.update({
      where: { id },
      data,
    });
  }

  async deleteConversation(id: string): Promise<AgentConversation> {
    return this.prisma.agentConversation.delete({
      where: { id },
    });
  }
}
