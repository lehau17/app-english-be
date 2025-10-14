import { Injectable, Logger } from '@nestjs/common';
import { AgentChatDto, AgentChatResponseDto, AgentRecommendationDto } from './dto/agent.dto';
import { GeminiService } from '@app/shared/ai/gemini.service';
import { PrismaRepository } from '@app/database';
import { KnowledgeDocument, Prisma } from '@prisma/client';
import { AgentChatRepository } from './repository/agent-chat.repository';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly prisma: PrismaRepository,
    private readonly agentChatRepo: AgentChatRepository,
  ) {}

  async chatWithAI(chatDto: AgentChatDto, userId: string): Promise<AgentChatResponseDto> {
    const { message, conversationId } = chatDto;
    try {
      this.logger.log(`💬 Bắt đầu xử lý RAG cho tin nhắn: "${message.substring(0, 50)}..."`);

      // 1. Create Embedding for the user's question
      const questionEmbedding = await this.geminiService.generateEmbedding(message);

      // 2. Vector Search for relevant documents
      const embeddingVector = `[${questionEmbedding.join(',')}]`;
      const relevantDocuments = await this.prisma.$queryRaw<
        (KnowledgeDocument & { distance: number })[]
      >`
        SELECT
          id, title, content, "embedding_vector" <=> ${embeddingVector}::vector AS distance
        FROM "knowledge_documents"
        WHERE "embedding_vector" IS NOT NULL
        ORDER BY distance ASC
        LIMIT 3
      `;

      this.logger.log(`🔍 Tìm thấy ${relevantDocuments.length} tài liệu liên quan.`);

      // 3. Create Enhanced Prompt
      let prompt: string;
      const context = relevantDocuments
        .map(doc => `Tiêu đề: ${doc.title}\nNội dung: ${doc.content}`)
        .join('\n\n---\n\n');

      if (relevantDocuments.length > 0) {
        prompt = `
          Bạn là một trợ lý AI thông thái. Dựa vào các thông tin được cung cấp dưới đây, hãy trả lời câu hỏi của người dùng một cách chính xác và chi tiết.

          Ngữ cảnh được truy xuất:
          """
          ${context}
          """

          Câu hỏi của người dùng: "${message}"

          Hãy trả lời câu hỏi dựa trên ngữ cảnh trên. Nếu thông tin không có trong ngữ cảnh, hãy nói rằng bạn không tìm thấy thông tin trong tài liệu.
        `;
      } else {
        prompt = `
          Bạn là một trợ lý AI thông thái. Hãy trả lời câu hỏi sau của người dùng: "${message}"
        `;
      }

      // 4. Send to Gemini and get the response
      const startTime = Date.now();
      const response = await this.geminiService.generateResponse(prompt);
      const processingTime = Date.now() - startTime;

      // 5. Save conversation history
      if (userId) {
          const convId = await this.agentChatRepo.logMessage(userId, conversationId, 'user', message);
          await this.agentChatRepo.logMessage(userId, convId, 'assistant', response);
      }

      return {
        response,
        confidence: relevantDocuments.length > 0 ? 0.85 : 0.5, // Simple confidence score
        sources: relevantDocuments.map(doc => doc.title),
        processingTime,
      };

    } catch (error) {
      this.logger.error('Lỗi khi xử lý chat với AI (RAG):', error);
      return {
        response: 'Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.',
        confidence: 0,
        sources: [],
        processingTime: 0,
        reasoning: `Error: ${(error as any)?.message || 'Unknown error'}`,
      };
    }
  }

  async getRecommendations(): Promise<AgentRecommendationDto[]> {
    try {
      this.logger.log('📊 Generating AI recommendations');
      // This can be enhanced later to be more dynamic
      const recommendations: AgentRecommendationDto[] = [
        {
          id: 'rec_study_plan',
          type: 'learning',
          title: 'Tạo lộ trình học tập mới',
          description:
            'Phân tích hiệu suất của bạn để tạo ra một kế hoạch học tập được cá nhân hóa.',
          confidence: 0.9,
        },
        {
          id: 'rec_weak_areas',
          type: 'improvement',
          title: 'Kiểm tra điểm yếu',
          description:
            'Bạn có muốn tôi phân tích các bài làm gần đây để tìm ra kỹ năng cần cải thiện không?',
          confidence: 0.8,
        },
      ];
      return recommendations;
    } catch (error) {
      this.logger.error('Failed to generate recommendations:', error);
      return [];
    }
  }
}