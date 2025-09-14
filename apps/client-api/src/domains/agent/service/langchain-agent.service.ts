import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { SwaggerService } from '../../swagger/swagger.service';
import { ApiSearchTool } from '../tools/api-search.tool';
import { ApiTool } from '../tools/api.tool';
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
    private swaggerService: SwaggerService,
    private apiSearch: ApiSearchTool,
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

      const tools = [
        new RagTool(this.ragService),
        new SqlTool(this.sqlService),
        new ApiTool(this.swaggerService),
        new ApiSearchTool(this.swaggerService),
      ];

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `
Bạn có 4 công cụ:
- api_search: TÌM endpoint phù hợp từ Swagger (không cần operationId).
- call_api: GỌI endpoint bằng method+path. Tự gắn Bearer token từ request.
- database_query: SELECT-only cho thống kê nếu không có endpoint phù hợp.
- knowledge_search: Tra cứu policy/FAQ (RAG).

Quy tắc:
1) Khi người dùng muốn dữ liệu từ hệ thống → GỌI api_search với từ khoá (vi/en), ưu tiên vi để lấy candidates.
2) Chọn candidate phù hợp nhất rồi GỌI call_api(method+path, query/body/pathParams).
3) Nếu Swagger không có endpoint phù hợp → fallback database_query hoặc knowledge_search.
4) Trả lời **Markdown** ngắn gọn, nêu rõ dữ liệu đến từ API nào (method path).
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
