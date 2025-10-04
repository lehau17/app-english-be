import { Injectable } from '@nestjs/common';
import {
  AgentChatDto,
  AgentChatResponseDto,
  AgentRecommendationDto,
} from '../dto/agent.dto';
import { AgentChatRepository } from '../repository';
import { LangChainAgentService } from './langchain-agent.service';

@Injectable()
export class AgentService {
  constructor(
    private langchainAgent: LangChainAgentService,
    private agentChatRepository: AgentChatRepository,
  ) {}

  async chatWithAI(
    chatDto: AgentChatDto,
    userId: string,
  ): Promise<AgentChatResponseDto> {
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
        // Create new conversation
        const newConversation =
          await this.agentChatRepository.createConversation({
            userId,
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

      // Use LangChain agent for actual AI processing with chat history
      const result = await this.langchainAgent.processUserQuery(
        chatDto.message,
        chatHistory,
      );

      // Save AI response
      await this.agentChatRepository.createMessage({
        conversationId,
        role: 'assistant',
        content: result.answer,
        metadata: {
          toolsUsed: result.toolsUsed,
          reasoning: result.reasoning,
          processingTime: result.processingTime,
        },
      });

      // Update conversation timestamp
      await this.agentChatRepository.updateConversation(conversationId, {
        updatedAt: new Date(),
      });

      const processingTime = Date.now() - startTime;

      return {
        response: result.answer,
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
  ): AsyncGenerator<{
    type: 'token' | 'tool' | 'complete' | 'error' | 'metadata';
    content?: string;
    tool?: string;
    toolInput?: any;
    data?: any;
  }> {
    try {
      const startTime = Date.now();

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

      // Stream response from LangChain
      let fullAnswer = '';
      let toolsUsed: string[] = [];
      let reasoning = '';
      let executionSteps: any[] = [];

      for await (const chunk of this.langchainAgent.streamUserQuery(
        chatDto.message,
        chatHistory,
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
