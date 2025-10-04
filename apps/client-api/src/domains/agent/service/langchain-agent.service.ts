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
        streaming: true, // Enable streaming
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
- knowledge_search: Tra cứu knowledge base (quy định/FAQ/khóa học/bài học/từ vựng/hoạt động).

Quy tắc:
1) Khi người dùng muốn dữ liệu từ hệ thống → GỌI api_search với từ khoá (vi/en), ưu tiên vi để lấy candidates.
2) Chọn candidate phù hợp nhất rồi GỌI call_api(method+path, query/body/pathParams).
3) Khi người dùng hỏi về khóa học, bài học, từ vựng, hoạt động → ưu tiên dùng knowledge_search để tìm thông tin chi tiết.
4) Nếu Swagger không có endpoint phù hợp → fallback database_query hoặc knowledge_search.
5) Trả lời **Markdown** ngắn gọn, nêu rõ dữ liệu đến từ API nào (method path) hoặc knowledge base.
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

  async processUserQuery(
    question: string,
    chatHistory: Array<{ role: string; content: string }> = [],
  ) {
    const start = Date.now();

    // Convert chat history to LangChain format
    const formattedHistory = chatHistory.map((msg) => {
      if (msg.role === 'user') {
        return ['human', msg.content];
      } else {
        return ['assistant', msg.content];
      }
    });

    const result = await this.agent.invoke({
      input: question,
      chat_history: formattedHistory,
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

  async *streamUserQuery(
    question: string,
    chatHistory: Array<{ role: string; content: string }> = [],
  ): AsyncGenerator<{
    type: 'token' | 'tool' | 'complete' | 'error';
    content?: string;
    tool?: string;
    toolInput?: any;
    data?: any;
  }> {
    const start = Date.now();

    try {
      this.logger.debug(`🌊 Starting stream for: "${question}"`);

      // Convert chat history to LangChain format
      const formattedHistory = chatHistory.map((msg) => {
        if (msg.role === 'user') {
          return ['human', msg.content];
        } else {
          return ['assistant', msg.content];
        }
      });

      let fullAnswer = '';
      const toolsUsedSet = new Set<string>();
      const steps: any[] = [];

      // Use streamLog instead of stream for better token-by-token streaming
      const stream = await this.agent.streamLog({
        input: question,
        chat_history: formattedHistory,
      });

      for await (const chunk of stream) {
        this.logger.debug('📦 Stream chunk:', JSON.stringify(chunk).substring(0, 200));

        // Handle LLM token streaming
        if (chunk.ops) {
          for (const op of chunk.ops) {
            // Check for streamed tokens
            if (op.op === 'add') {
              const path = op.path || '';

              // LLM streaming tokens (during thinking)
              if (path.includes('/streamed_output_str/-')) {
                const token = op.value;
                if (token && typeof token === 'string') {
                  this.logger.debug(`💬 Token: "${token}"`);
                  fullAnswer += token;
                  yield { type: 'token', content: token };
                }
              }

              // Final output (after tool execution) - needs manual tokenization
              if (path === '/streamed_output/-') {
                const output = op.value?.output;
                if (output && typeof output === 'string') {
                  this.logger.debug(`📝 Final output: "${output.substring(0, 100)}..."`);

                  // Manual tokenization: split by words and stream word-by-word
                  const words = output.split(/(\s+)/); // Keep whitespace
                  for (const word of words) {
                    if (word) {
                      fullAnswer += word;
                      yield { type: 'token', content: word };
                      // Small delay for smooth streaming (optional)
                      await new Promise(resolve => setTimeout(resolve, 10));
                    }
                  }
                }
              }

              // Tool calls
              if (path.includes('/actions/-')) {
                const action = op.value;
                if (action?.tool) {
                  this.logger.debug(`🔧 Tool: ${action.tool}`);
                  toolsUsedSet.add(action.tool);
                  yield {
                    type: 'tool',
                    tool: action.tool,
                    toolInput: action.toolInput,
                  };
                }
              }
            }
          }
        }

        // Collect final steps
        if ((chunk as any).state?.intermediateSteps) {
          steps.push(...(chunk as any).state.intermediateSteps);
        }
      }

      this.logger.log(`✅ Streaming complete. Total length: ${fullAnswer.length}`);

      // Send completion event
      const toolsUsed = Array.from(toolsUsedSet);
      const reasoning = steps
        .map((s: any, i: number) => {
          const tool = s.action?.tool || 'thinking';
          const input = s.action?.toolInput || s.action?.log || '';
          return `Bước ${i + 1}: ${tool} - ${JSON.stringify(input)}`;
        })
        .join('\n');

      yield {
        type: 'complete',
        data: {
          answer: fullAnswer,
          reasoning,
          toolsUsed,
          executionSteps: steps,
          processingTime: Date.now() - start,
        },
      };
    } catch (error) {
      this.logger.error('❌ Streaming error:', error);
      yield {
        type: 'error',
        content: error.message || 'Unknown error occurred',
      };
    }
  }
}
