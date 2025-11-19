import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import {
  AgentChatDto,
  AgentChatResponseDto,
  AgentRecommendationDto,
} from '../dto/agent.dto';
import { AgentChatRepository } from '../repository';
import { LangChainAgentService } from './langchain-agent.service';
import { ParentAgentService } from './parent-agent.service';
import { StudentAgentService } from './student-agent.service';

@Injectable()
export class AgentService {
  constructor(
    private langchainAgent: LangChainAgentService,
    private agentChatRepository: AgentChatRepository,
    private prisma: PrismaRepository,
    private studentAgentService: StudentAgentService,
    private parentAgentService: ParentAgentService,
  ) {}

  /**
   * Get user information formatted for AI context
   */
  private async getUserInfo(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        classroomsStudying: {
          include: {
            classroom: {
              include: {
                course: true,
              },
            },
          },
        },
        classroomsTeaching: {
          include: {
            course: true,
          },
        },
        childRelations: {
          include: {
            child: {
              include: {
                classroomsStudying: {
                  include: {
                    classroom: {
                      include: {
                        course: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return 'Không tìm thấy thông tin người dùng.';
    }

    // Build full name from firstName + lastName
    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.displayName ||
      'Chưa cập nhật';

    let info = `- Tên: ${fullName}\n`;
    info += `- Email: ${user.email || 'Chưa có'}\n`;
    info += `- Vai trò: ${user.role}\n`;

    // Student info
    if (user.role === 'student' && user.classroomsStudying.length > 0) {
      const classrooms = user.classroomsStudying.map(
        (cs) => `${cs.classroom.name} (${cs.classroom.course.title})`,
      );
      info += `- Lớp học hiện tại: ${classrooms.join(', ')}\n`;
    }

    // Teacher info
    if (user.role === 'teacher' && user.classroomsTeaching.length > 0) {
      const classrooms = user.classroomsTeaching.map(
        (c) => `${c.name} (${c.course.title})`,
      );
      info += `- Lớp giảng dạy: ${classrooms.join(', ')}\n`;
    }

    // Parent info
    if (user.role === 'parent' && user.childRelations.length > 0) {
      const children = user.childRelations.map((relation) => {
        const child = relation.child;
        const childName =
          [child.firstName, child.lastName].filter(Boolean).join(' ') ||
          child.displayName ||
          'Con';
        const childClasses = child.classroomsStudying.map(
          (cs) => `${cs.classroom.name}`,
        );
        return `${childName} (${childClasses.length > 0 ? childClasses.join(', ') : 'chưa tham gia lớp'})`;
      });
      info += `- Con em: ${children.join(', ')}\n`;
    }

    return info;
  }

  async chatWithAI(
    chatDto: AgentChatDto,
    userId: string,
    userRole: string = 'student',
  ): Promise<AgentChatResponseDto> {
    if (userRole === 'student') {
      const result = await this.studentAgentService.processQuery(
        chatDto.message,
        userId,
        chatDto.conversationId,
      );

      return {
        response: result.answer,
        conversationId: result.conversationId,
        confidence: 0.9,
        sources: ['Student profile', 'Knowledge base'],
        suggestions: [],
        toolsUsed: result.toolsUsed,
        reasoning: result.reasoning,
        processingTime: result.processingTime,
        executionSteps: result.executionSteps,
      };
    }

    if (userRole === 'parent') {
      const result = await this.parentAgentService.processQuery(
        chatDto.message,
        userId,
        chatDto.conversationId,
      );

      return {
        response: result.answer,
        conversationId: result.conversationId,
        confidence: 0.9,
        sources: ['Parent profile', 'Knowledge base'],
        suggestions: [],
        toolsUsed: result.toolsUsed,
        reasoning: result.reasoning,
        processingTime: result.processingTime,
        executionSteps: result.executionSteps,
      };
    }

    try {
      const startTime = Date.now();

      // Get or create conversation
      let conversationId = chatDto.conversationId;
      let chatHistory: Array<{ role: string; content: string }> = [];

      if (conversationId) {
        // Load existing conversation and its history
        const conversation =
          await this.agentChatRepository.findConversationById(conversationId);
        if (conversation && conversation.userId === userId) {
          // Get last N messages for context (e.g., last 10 messages)
          chatHistory = conversation.messages.slice(-10).map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));
        } else {
          // Invalid conversation ID or user doesn't own it, create new
          conversationId = undefined;
        }
      }

      if (!conversationId) {
        // Create new conversation with role
        const newConversation =
          await this.agentChatRepository.createConversation({
            userId,
            role: userRole,
            title: chatDto.message.substring(0, 50),
          });
        conversationId = newConversation.id;
      }

      // Save user message
      await this.agentChatRepository.createMessage({
        conversationId,
        role: 'user',
        content: chatDto.message,
      });

      // Get user info for context
      const userInfo = await this.getUserInfo(userId);

      // Use LangChain agent for actual AI processing with chat history and role
      const result = await this.langchainAgent.processUserQuery(
        chatDto.message,
        chatHistory,
        userRole,
        userInfo,
      );

      // Save AI response
      const aiContent =
        (result as any).response || (result as any).answer || '';
      await this.agentChatRepository.createMessage({
        conversationId,
        role: 'assistant',
        content: aiContent,
        metadata: {
          toolsUsed: (result as any).toolsUsed,
          reasoning: (result as any).reasoning,
          processingTime: (result as any).processingTime,
        },
      });

      // Update conversation timestamp
      await this.agentChatRepository.updateConversation(conversationId, {
        updatedAt: new Date(),
      });

      const processingTime = Date.now() - startTime;

      return {
        response: aiContent,
        conversationId,
        confidence: 0.85, // Could be calculated based on result quality
        sources: ['Knowledge Base', 'Database', 'API Documentation'],
        suggestions: [
          'Try asking about student data',
          'Ask about course information',
          'Inquire about system policies',
        ],
        toolsUsed: result.toolsUsed,
        reasoning: result.reasoning,
        processingTime,
        executionSteps: result.executionSteps,
      };
    } catch (error) {
      console.error('Error in AI chat:', error);
      return {
        response:
          'I apologize, but I encountered an error processing your request. Please try again.',
        confidence: 0.1,
        sources: [],
        suggestions: [
          'Try rephrasing your question',
          'Check your internet connection',
        ],
        toolsUsed: [],
        reasoning: 'Error occurred during processing',
        processingTime: 0,
        executionSteps: [],
      };
    }
  }

  async getRecommendations(): Promise<AgentRecommendationDto[]> {
    try {
      // Mock recommendations - in real implementation, this would analyze user progress
      const recommendations = [
        {
          id: '1',
          type: 'vocabulary',
          title: 'Expand Your Vocabulary',
          description:
            'Focus on learning 10 new words daily to improve comprehension',
          confidence: 0.85,
        },
        {
          id: '2',
          type: 'grammar',
          title: 'Practice Past Tense',
          description: 'You seem to struggle with irregular past tense verbs',
          confidence: 0.78,
        },
        {
          id: '3',
          type: 'speaking',
          title: 'Conversation Practice',
          description: 'Join speaking sessions to build confidence',
          confidence: 0.92,
        },
        {
          id: '4',
          type: 'listening',
          title: 'Improve Listening Skills',
          description: 'Practice with podcasts and videos at your level',
          confidence: 0.88,
        },
      ];

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      return recommendations;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }

  async getUserConversations(userId: string, limit = 20, offset = 0) {
    return this.agentChatRepository.findUserConversations(userId, {
      limit,
      offset,
    });
  }

  async getConversation(conversationId: string, userId: string) {
    const conversation =
      await this.agentChatRepository.findConversationById(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error('Conversation not found or access denied');
    }
    return conversation;
  }

  async deleteConversation(conversationId: string, userId: string) {
    const conversation =
      await this.agentChatRepository.findConversationById(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error('Conversation not found or access denied');
    }
    return this.agentChatRepository.deleteConversation(conversationId);
  }

  async *streamChatWithAI(
    chatDto: AgentChatDto,
    userId: string,
    userRole: string = 'student',
  ): AsyncGenerator<any, void, unknown> {
    if (userRole === 'student') {
      try {
        for await (const chunk of this.studentAgentService.streamQuery(
          chatDto.message,
          userId,
          chatDto.conversationId,
        )) {
          yield chunk;
        }
      } catch (error) {
        yield {
          type: 'error',
          content:
            (error as Error).message ||
            'I apologize, but I encountered an error. Please try again.',
        };
      }
      return;
    }

    if (userRole === 'parent') {
      try {
        for await (const chunk of this.parentAgentService.streamQuery(
          chatDto.message,
          userId,
          chatDto.conversationId,
        )) {
          yield chunk;
        }
      } catch (error) {
        yield {
          type: 'error',
          content:
            (error as Error).message ||
            'Xin lỗi, đã xảy ra lỗi khi kết nối với trợ lý phụ huynh. Vui lòng thử lại.',
        };
      }
      return;
    }

    try {
      const startTime = Date.now();

      // ✅ Validate userId exists in database
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Verify user exists in database
      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!userExists) {
        throw new Error(`User with ID ${userId} does not exist in database`);
      }

      // Get or create conversation
      let conversationId = chatDto.conversationId;
      let chatHistory: Array<{ role: string; content: string }> = [];

      if (conversationId) {
        const conversation =
          await this.agentChatRepository.findConversationById(conversationId);
        if (conversation && conversation.userId === userId) {
          chatHistory = conversation.messages.slice(-10).map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));
        } else {
          conversationId = undefined;
        }
      }

      if (!conversationId) {
        const newConversation =
          await this.agentChatRepository.createConversation({
            userId,
            role: userRole,
            title: chatDto.message.substring(0, 50),
          });
        conversationId = newConversation.id;
      }

      // Save user message
      await this.agentChatRepository.createMessage({
        conversationId,
        role: 'user',
        content: chatDto.message,
      });

      // Send metadata first
      yield {
        type: 'metadata',
        data: { conversationId },
      };

      // Get user info for context
      const userInfo = await this.getUserInfo(userId);

      // Stream response from LangChain
      let fullAnswer = '';
      let toolsUsed: string[] = [];
      let reasoning = '';
      let executionSteps: any[] = [];

      for await (const chunk of this.langchainAgent.streamUserQuery(
        chatDto.message,
        chatHistory,
        userRole,
        userInfo,
      )) {
        yield chunk;

        if (chunk.type === 'token' && chunk.content) {
          fullAnswer += chunk.content;
        } else if (chunk.type === 'complete' && chunk.data) {
          fullAnswer = chunk.data.answer;
          toolsUsed = chunk.data.toolsUsed;
          reasoning = chunk.data.reasoning;
          executionSteps = chunk.data.executionSteps;
        }
      }

      // Save AI response
      await this.agentChatRepository.createMessage({
        conversationId,
        role: 'assistant',
        content: fullAnswer,
        metadata: {
          toolsUsed,
          reasoning,
          executionSteps,
          processingTime: Date.now() - startTime,
        },
      });

      // Update conversation timestamp
      await this.agentChatRepository.updateConversation(conversationId, {
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('❌ Error in streaming chat:', error);
      yield {
        type: 'error',
        content:
          error.message ||
          'I apologize, but I encountered an error. Please try again.',
      };
    }
  }
}
