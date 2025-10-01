import { Injectable, Logger } from '@nestjs/common';
import {
  AgentChatDto,
  AgentChatResponseDto,
  AgentRecommendationDto,
} from './dto/agent.dto';
import { LangChainAgentService } from './service/langchain-agent.service';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private langchainAgent: LangChainAgentService) {}

  async chatWithAI(chatDto: AgentChatDto): Promise<AgentChatResponseDto> {
    try {
      this.logger.log(
        `💬 Agent chat request: ${chatDto.message?.substring(0, 100)}...`,
      );

      const result = await this.langchainAgent.processUserQuery(
        chatDto.message,
      );

      return {
        response: result.answer,
        confidence: this.calculateConfidence(result),
        sources: this.extractSources(result),
        suggestions: this.generateSuggestions(chatDto.message, result),
        toolsUsed: result.toolsUsed || [],
        reasoning: result.reasoning,
        processingTime: result.processingTime,
        executionSteps: result.executionSteps || [],
      };
    } catch (error) {
      this.logger.error('Chat with AI failed:', error);
      return {
        response:
          'Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.',
        confidence: 0,
        toolsUsed: [],
        processingTime: 0,
        reasoning: `Error: ${(error as any)?.message || 'Unknown error'}`,
      };
    }
  }

  async getRecommendations(): Promise<AgentRecommendationDto[]> {
    try {
      this.logger.log('📊 Generating AI recommendations');

      // Sample intelligent recommendations based on system usage patterns
      const recommendations: AgentRecommendationDto[] = [
        {
          id: 'rec_study_plan',
          type: 'learning',
          title: 'Tối ưu kế hoạch học tập',
          description:
            'Dựa trên tiến độ hiện tại, bạn nên tập trung vào các bài học có độ khó trung bình trước.',
          confidence: 0.85,
        },
        {
          id: 'rec_weak_areas',
          type: 'improvement',
          title: 'Cải thiện điểm yếu',
          description:
            'Phát hiện bạn gặp khó khăn với bài tập nghe hiểu. Khuyến nghị tăng cường luyện tập.',
          confidence: 0.78,
        },
        {
          id: 'rec_engagement',
          type: 'engagement',
          title: 'Tăng cường tương tác',
          description:
            'Tham gia thảo luận nhóm và chat với AI để cải thiện kỹ năng giao tiếp.',
          confidence: 0.72,
        },
      ];

      return recommendations;
    } catch (error) {
      this.logger.error('Failed to generate recommendations:', error);
      return [];
    }
  }

  private calculateConfidence(result: any): number {
    // Calculate confidence based on various factors
    let confidence = 0.5; // base confidence

    // Increase confidence if tools were used successfully
    if (result.toolsUsed && result.toolsUsed.length > 0) {
      confidence += 0.2;
    }

    // Increase confidence if answer is substantial
    if (result.answer && result.answer.length > 100) {
      confidence += 0.15;
    }

    // Increase confidence if processing was fast (< 5 seconds)
    if (result.processingTime && result.processingTime < 5000) {
      confidence += 0.1;
    }

    // Decrease confidence if there were errors in execution steps
    if (
      result.executionSteps &&
      result.executionSteps.some((step: any) => step.error)
    ) {
      confidence -= 0.2;
    }

    return Math.min(Math.max(confidence, 0), 1); // clamp between 0 and 1
  }

  private extractSources(result: any): string[] {
    const sources: string[] = [];

    // Extract sources from execution steps
    if (result.executionSteps) {
      result.executionSteps.forEach((step: any) => {
        if (step.observation) {
          try {
            const obs = JSON.parse(step.observation);
            if (obs.sources) {
              sources.push(
                ...obs.sources.map((s: any) => s.title || s.source || s.id),
              );
            }
          } catch {
            // ignore parsing errors
          }
        }
      });
    }

    return sources.filter((s, i, arr) => arr.indexOf(s) === i); // deduplicate
  }

  private generateSuggestions(message: string, result: any): string[] {
    const suggestions: string[] = [];

    // Generate contextual suggestions based on the query and tools used
    if (result.toolsUsed?.includes('knowledge_search')) {
      suggestions.push('Tìm hiểu thêm về quy định liên quan');
      suggestions.push('Xem các tài liệu tham khảo khác');
    }

    if (result.toolsUsed?.includes('database_query')) {
      suggestions.push('Xem thống kê chi tiết hơn');
      suggestions.push('So sánh với các kỳ trước');
    }

    if (message.toLowerCase().includes('học')) {
      suggestions.push('Tìm khóa học phù hợp');
      suggestions.push('Đặt lịch học thử');
    }

    return suggestions;
  }
}
