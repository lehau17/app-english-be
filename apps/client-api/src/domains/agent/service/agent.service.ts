import { Injectable } from '@nestjs/common';
import { AgentChatDto, AgentChatResponseDto, AgentRecommendationDto } from '../dto/agent.dto';
import { LangChainAgentService } from './langchain-agent.service';

@Injectable()
export class AgentService {
  constructor(private langchainAgent: LangChainAgentService) {}

  async chatWithAI(chatDto: AgentChatDto): Promise<AgentChatResponseDto> {
    try {
      const startTime = Date.now();

      // Use LangChain agent for actual AI processing
      const result = await this.langchainAgent.processUserQuery(chatDto.message);

      const processingTime = Date.now() - startTime;

      return {
        response: result.answer,
        confidence: 0.85, // Could be calculated based on result quality
        sources: ['Knowledge Base', 'Database', 'API Documentation'],
        suggestions: [
          'Try asking about student data',
          'Ask about course information',
          'Inquire about system policies'
        ],
        toolsUsed: result.toolsUsed,
        reasoning: result.reasoning,
        processingTime,
        executionSteps: result.executionSteps
      };
    } catch (error) {
      console.error('Error in AI chat:', error);
      return {
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
        confidence: 0.1,
        sources: [],
        suggestions: ['Try rephrasing your question', 'Check your internet connection'],
        toolsUsed: [],
        reasoning: 'Error occurred during processing',
        processingTime: 0,
        executionSteps: []
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
          description: 'Focus on learning 10 new words daily to improve comprehension',
          confidence: 0.85
        },
        {
          id: '2',
          type: 'grammar',
          title: 'Practice Past Tense',
          description: 'You seem to struggle with irregular past tense verbs',
          confidence: 0.78
        },
        {
          id: '3',
          type: 'speaking',
          title: 'Conversation Practice',
          description: 'Join speaking sessions to build confidence',
          confidence: 0.92
        },
        {
          id: '4',
          type: 'listening',
          title: 'Improve Listening Skills',
          description: 'Practice with podcasts and videos at your level',
          confidence: 0.88
        }
      ];

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      return recommendations;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }
}
