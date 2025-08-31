import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { RagTool } from '../tools/rag.tool';
import { SqlTool } from '../tools/sql.tool';
import { RagService } from './rag.service';
import { SqlService } from './sql.service';

@Injectable()
export class LangChainAgentService {
  private readonly logger = new Logger(LangChainAgentService.name);
  private agent!: AgentExecutor;

  constructor(
    private ragService: RagService,
    private sqlService: SqlService,
  ) {
    // không await trong ctor: gọi initialize() ở nơi thích hợp nếu cần
    void this.initializeAgent();
  }

  private async initializeAgent() {
    try {
      this.logger.log('🤖 Khởi tạo LangChain Agent...');

      const llm = new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-flash',
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0.1,
      });

      const tools = [new RagTool(this.ragService), new SqlTool(this.sqlService)];

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `
Bạn có 2 công cụ:
- knowledge_search: dùng cho policy/process/faq ("là gì", "quy định", "cách...")
- database_query: dùng cho thống kê/ranking/danh sách/tìm record (real-time data)

Quy tắc:
1) Phân loại câu hỏi → chọn tool phù hợp (có thể dùng nhiều tool).
2) Ưu tiên trả lời bằng dữ liệu/nguồn cụ thể.
3) Trả lời ngắn gọn, tiếng Việt.
MỌI CÂU TRẢ LỜI CHO NGƯỜI DÙNG PHẢI DƯỚI DẠNG **MARKDOWN** CHUẨN,
dùng ### tiêu đề, danh sách -, và bảng Markdown khi phù hợp.
`,
        ],
        ['placeholder', '{chat_history}'],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ]);

      const agent = await createToolCallingAgent({
        llm,
        tools,
        prompt,
      });

      this.agent = new AgentExecutor({
        agent,
        tools,
        verbose: true,
        maxIterations: 5,
        returnIntermediateSteps: true,
      });

      this.logger.log('✅ LangChain Agent sẵn sàng');
    } catch (e) {
      this.logger.error('❌ Lỗi init Agent:', e as any);
      throw e;
    }
  }
s
  async processUserQuery(question: string) {
    const start = Date.now();
    const result = await this.agent.invoke({
      input: question,
      chat_history: [],
    });

    const toolsUsed = (result.intermediateSteps || [])
      .map((s: any) => s.action?.tool)
      .filter(Boolean)
      .filter((t: string, i: number, arr: string[]) => arr.indexOf(t) === i);

    const reasoning = (result.intermediateSteps || [])
      .map((s: any, i: number) => {
        const tool = s.action?.tool || 'thinking';
        const input = s.action?.toolInput || s.action?.log || '';
        return `Bước ${i + 1}: ${tool} - ${JSON.stringify(input)}`;
      })
      .join('\n');

    return {
      answer: result.output,
      reasoning,
      toolsUsed,
      executionSteps: result.intermediateSteps || [],
      processingTime: Date.now() - start,
    };
  }
}
