import { PrismaRepository } from '@app/database';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { LandingConsultantService } from './landing-consultant.service';

@Injectable()
export class GuestChatService {
  private readonly logger = new Logger(GuestChatService.name);

  constructor(
    private prisma: PrismaRepository,
    private landingConsultant: LandingConsultantService,
  ) {}

  /**
   * Tạo conversation mới cho guest hoặc tiếp tục conversation cũ
   */
  async createOrContinueChat(
    question: string,
    guestSessionId?: string,
  ): Promise<{
    conversationId: string;
    guestSessionId: string;
    answer: string;
    isNewConversation: boolean;
  }> {
    const finalGuestSessionId = guestSessionId || uuidv4();
    let conversation;
    let isNewConversation = false;

    // Tìm conversation hiện có của guest
    const existingConversation = await this.prisma.agentConversation.findFirst({
      where: {
        guestSessionId: finalGuestSessionId,
        role: 'guest',
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existingConversation) {
      conversation = existingConversation;
      this.logger.log(
        `♻️  Continue conversation ${conversation.id} for guest ${finalGuestSessionId}`,
      );
    } else {
      // Tạo conversation mới
      conversation = await this.prisma.agentConversation.create({
        data: {
          role: 'guest',
          guestSessionId: finalGuestSessionId,
          title: question.substring(0, 100), // Lấy 100 ký tự đầu làm title
        },
      });
      isNewConversation = true;
      this.logger.log(
        `🆕 Created new conversation ${conversation.id} for guest ${finalGuestSessionId}`,
      );
    }

    // Lưu user message
    await this.prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: question,
      },
    });

    // Lấy lịch sử messages của conversation này để có context
    const messages = await this.prisma.agentMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        content: true,
      },
    });

    // Format chat history cho LangChain (bỏ message vừa thêm vì đã có trong input)
    const chatHistory = messages.slice(0, -1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Gọi AI agent với context
    const result = await this.landingConsultant.processQuery(
      question,
      chatHistory,
    );

    // Lưu assistant message
    await this.prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: result.answer,
        metadata: {
          toolsUsed: result.toolsUsed,
          processingTime: result.processingTime,
        },
      },
    });

    return {
      conversationId: conversation.id,
      guestSessionId: finalGuestSessionId,
      answer: result.answer,
      isNewConversation,
    };
  }

  /**
   * Stream chat cho guest với conversation ID
   */
  async *streamGuestChat(
    conversationId: string,
    question: string,
  ): AsyncGenerator<any> {
    const conversation = await this.prisma.agentConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Lưu user message
    await this.prisma.agentMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: question,
      },
    });

    // Lấy lịch sử messages của conversation này để có context
    const messages = await this.prisma.agentMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        content: true,
      },
      take: 5,
    });

    // Format chat history cho LangChain (bỏ message vừa thêm vì đã có trong input)
    const chatHistory = messages.slice(0, -1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    let fullAnswer = '';

    // Stream từ AI agent với context
    try {
      for await (const chunk of this.landingConsultant.streamQuery(
        question,
        chatHistory,
      )) {
        if (chunk.output) {
          fullAnswer += chunk.output;
        }
        yield chunk;
      }

      // Lưu assistant message sau khi stream xong
      await this.prisma.agentMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: fullAnswer,
        },
      });
    } catch (error) {
      this.logger.error('Error streaming guest chat:', error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử chat của guest
   */
  async getChatHistory(guestSessionId: string): Promise<{
    conversations: Array<{
      id: string;
      title: string | null;
      createdAt: Date;
      messages: Array<{
        id: string;
        role: string;
        content: string;
        createdAt: Date;
      }>;
    }>;
  }> {
    const conversations = await this.prisma.agentConversation.findMany({
      where: {
        guestSessionId,
        role: 'guest',
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { conversations };
  }

  /**
   * Lấy một conversation cụ thể
   */
  async getConversationById(conversationId: string) {
    const conversation = await this.prisma.agentConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }
}
