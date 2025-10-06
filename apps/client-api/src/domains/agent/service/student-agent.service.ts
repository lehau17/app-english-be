import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { RagService } from './rag.service';
import { SqlService } from './sql.service';
import { StudentAgentTools } from '../tools/student-agent.tools';

@Injectable()
export class StudentAgentService {
  private readonly logger = new Logger(StudentAgentService.name);
  private agent!: AgentExecutor;

  constructor(
    private prisma: PrismaRepository,
    private ragService: RagService,
    private sqlService: SqlService,
    private studentTools: StudentAgentTools,
  ) {
    void this.initializeAgent();
  }

  private async initializeAgent() {
    try {
      this.logger.log('🎓 Khởi tạo Student Agent...');

      const llm = new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-flash',
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0.1,
        streaming: true,
      });

      const tools = this.studentTools.getTools();

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `
Bạn là trợ lý AI dành riêng cho HỌC SINH (Student).

🎯 NHIỆM VỤ:
- Hỗ trợ học sinh theo dõi tiến độ học tập
- Kiểm tra bài tập đã nộp/chưa nộp
- Gợi ý bài học tiếp theo
- Xem điểm số và thành tích
- Tìm podcast, listening exercises
- Giải thích từ vựng, ngữ pháp
- Động viên và khuyến khích học tập

🛠️ CÔNG CỤ:
1. **knowledge_search**: Tra cứu kiến thức (từ vựng, ngữ pháp, khóa học, bài học)
2. **database_query**: Truy vấn dữ liệu (assignments, progress, scores)
3. **get_my_assignments**: Lấy danh sách bài tập của học sinh
4. **get_my_progress**: Xem tiến độ học tập
5. **find_lessons**: Tìm bài học theo chủ đề
6. **get_leaderboard**: Xem bảng xếp hạng

📋 QUY TẮC:
- Luôn thân thiện, khuyến khích
- Trả lời bằng tiếng Việt (trừ khi học sinh yêu cầu tiếng Anh)
- Động viên khi học sinh gặp khó khăn
- Gợi ý cách học hiệu quả
- KHÔNG thực hiện các tác vụ của admin (chấm điểm, quản lý lớp)

💡 CÁCH TRẢ LỜI:
- Ngắn gọn, rõ ràng
- Sử dụng emoji phù hợp
- Cung cấp action items cụ thể
- Đề xuất các bước tiếp theo
`,
        ],
        ['placeholder', '{chat_history}'],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ]);

      const agentRunnable = await createToolCallingAgent({ llm, tools, prompt });

      this.agent = new AgentExecutor({
        agent: agentRunnable,
        tools,
        verbose: true,
        maxIterations: 5,
        returnIntermediateSteps: true,
      });
      this.logger.log('✅ Student Agent initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Student Agent:', error);
      throw error;
    }
  }

  async processQuery(
    message: string,
    userId: string,
    chatHistory: Array<{ role: string; content: string }> = [],
  ) {
    try {
      const startTime = Date.now();

      // Format chat history for LangChain
      const formattedHistory = chatHistory
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n');

      const result = await this.agent.invoke({
        input: message,
        chat_history: formattedHistory,
        userId, // Pass userId to tools
      });

      const processingTime = Date.now() - startTime;

      // Extract tools used
      const toolsUsed =
        result.intermediateSteps?.map((step: any) => step.action?.tool) || [];

      return {
        answer: result.output,
        toolsUsed,
        processingTime,
        executionSteps: result.intermediateSteps || [],
        reasoning: result.output, // Could extract reasoning from steps
      };
    } catch (error) {
      this.logger.error('Error processing student query:', error);
      throw error;
    }
  }

  async *streamQuery(
    message: string,
    userId: string,
    chatHistory: Array<{ role: string; content: string }> = [],
  ): AsyncGenerator<any> {
    try {
      const formattedHistory = chatHistory
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n');

      const stream = await this.agent.stream({
        input: message,
        chat_history: formattedHistory,
        userId,
      });

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      this.logger.error('Error streaming student query:', error);
      throw error;
    }
  }
}
