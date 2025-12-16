import { PrismaRepository } from '@app/database';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ParentAgentTools } from '../tools/parent-agent.tools';
import { RagService } from './rag.service';
import { SqlService } from './sql.service';

@Injectable()
export class ParentAgentService {
  private readonly logger = new Logger(ParentAgentService.name);
  private agent!: AgentExecutor;
  private agentReady: Promise<void>;

  constructor(
    private prisma: PrismaRepository,
    private ragService: RagService,
    private sqlService: SqlService,
    private parentTools: ParentAgentTools,
  ) {
    this.agentReady = this.initializeAgent();
  }

  private async initializeAgent() {
    const startTime = Date.now();
    try {
      this.logger.log('👨‍👩‍👧 Khởi tạo Parent Agent...');

      const llm = new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-pro',
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0.1,
        streaming: true,
      });

      const tools = this.parentTools.getTools();

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `
Bạn là trợ lý AI dành riêng cho PHỤ HUYNH (Parent).

NHIỆM VỤ:
- Theo dõi tiến độ học tập của con em
- Xem lịch học và điểm danh
- Kiểm tra thanh toán học phí
- Nhận thông báo từ giáo viên
- Xem báo cáo tổng quan về con
- Hỗ trợ phụ huynh hiểu rõ tình hình học tập của con

CÔNG CỤ:
1. **knowledge_search**: Tra cứu kiến thức (quy định, FAQ, khóa học)
2. **database_query**: Truy vấn dữ liệu (thống kê, điểm số)
3. **get_my_children**: Lấy danh sách con em
4. **get_child_progress**: Xem tiến độ học tập của con
5. **get_child_assignments**: Xem bài tập của con (đã nộp/chưa nộp/quá hạn)
6. **get_child_scores**: Xem điểm số của con
7. **get_child_schedule**: Xem lịch học của con
8. **get_payment_status**: Kiểm tra thanh toán học phí
9. **get_child_report**: Báo cáo tổng quan về con
10. **chart_generator**: Tạo biểu đồ trực quan

QUAN TRỌNG - KHI SỬ DỤNG CÔNG CỤ:
- Câu hỏi về "thống kê", "danh sách", "báo cáo" → LUÔN dùng database_query hoặc knowledge_search
- Câu hỏi về "tiến độ", "điểm số", "bài tập" → LUÔN dùng get_child_progress hoặc get_child_assignments
- Câu hỏi về "thanh toán", "học phí" → LUÔN dùng get_payment_status
- NẾU đây là câu hỏi đầu tiên (chat_history trống) VÀ có từ khóa trên → BẮT BUỘC gọi tool, KHÔNG trả lời trực tiếp
- Nếu không có dữ liệu con em → yêu cầu phụ huynh cung cấp thêm thông tin

QUY TẮC:
- Luôn thân thiện, tôn trọng
- Trả lời bằng tiếng Việt (trừ khi phụ huynh yêu cầu tiếng Anh)
- Giải thích rõ ràng về tình hình học tập của con
- Đưa ra gợi ý cụ thể để hỗ trợ con học tập
- KHÔNG thực hiện các tác vụ của học sinh, giáo viên hoặc admin

CÁCH TRẢ LỜI:
- Ngắn gọn, rõ ràng
- Sử dụng emoji phù hợp
- Cung cấp thông tin chi tiết về con em
- Đề xuất các bước tiếp theo để hỗ trợ con

📋 ĐỊNH DẠNG BẢNG (BẮT BUỘC):
Khi trình bày danh sách (con em, điểm số, bài tập, v.v.), **LUÔN DÙNG BẢNG MARKDOWN**:

| STT | Tên | Điểm | Trạng thái |
|-----|-----|------|------------|
| 1 | Nguyễn Văn A | 8.5 | Tốt |

- Danh sách ≥2 items → BẮT BUỘC dùng bảng
- KHÔNG dùng bullet points cho dữ liệu bảng
`,
        ],
        ['placeholder', '{chat_history}'],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ]);

      const agentRunnable = await createToolCallingAgent({
        llm,
        tools,
        prompt,
      });

      this.agent = new AgentExecutor({
        agent: agentRunnable,
        tools,
        verbose: true,
        maxIterations: 5,
        returnIntermediateSteps: true,
      });
      const initTime = Date.now() - startTime;
      this.logger.log(`Parent Agent initialized successfully in ${initTime}ms`);
    } catch (error) {
      this.logger.error('Failed to initialize Parent Agent:', error);
      throw error;
    }
  }

  /**
   * Ensure agent fully initialized before use
   */
  private async ensureAgentReady(): Promise<void> {
    const timeout = 10000;
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(
        () => reject(new Error('Agent initialization timeout after 10s')),
        timeout,
      );
    });

    try {
      await Promise.race([this.agentReady, timeoutPromise]);
    } catch (error) {
      this.logger.error('Agent not ready:', error);
      throw new Error(`Agent not initialized: ${(error as Error).message}`);
    }
  }

  /**
   * Detect if message requires tool usage (statistics/reports)
   */
  private isStatisticsQuery(message: string): boolean {
    const keywords = [
      'thống kê',
      'danh sách',
      'báo cáo',
      'report',
      'tiến độ',
      'progress',
      'điểm số',
      'scores',
      'bài tập',
      'assignment',
      'học phí',
      'thanh toán',
      'học sinh',
      'phụ huynh',
      'giáo viên',
      'teacher',
      'student',
      'parent',
    ];

    const lowerMessage = message.toLowerCase();
    return keywords.some((keyword) => lowerMessage.includes(keyword));
  }

  /**
   * Get personalized parent context for AI agent
   */
  private async getParentContext(userId: string): Promise<string> {
    try {
      const parent = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          childRelations: {
            include: {
              child: {
                select: {
                  id: true,
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  classroomsStudying: {
                    where: { isActive: true },
                    include: {
                      classroom: {
                        include: {
                          course: {
                            select: { title: true },
                          },
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

      if (!parent) {
        return 'Không tìm thấy thông tin phụ huynh.';
      }

      const parentName =
        parent.displayName ||
        `${parent.firstName || ''} ${parent.lastName || ''}`.trim() ||
        'Phụ huynh';

      if (!parent.childRelations || parent.childRelations.length === 0) {
        return `Phụ huynh: ${parentName}\nChưa có con em nào được liên kết trong hệ thống.`;
      }

      let context = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THÔNG TIN PHỤ HUYNH: ${parentName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CON EM:
`;

      for (const relation of parent.childRelations) {
        const child = relation.child;
        const childName =
          child.displayName ||
          `${child.firstName || ''} ${child.lastName || ''}`.trim() ||
          'Con';

        const classes = child.classroomsStudying.map(
          (cs) => `${cs.classroom.name} (${cs.classroom.course.title})`,
        );

        context += `\n• ${childName} (${child.email || 'Chưa có email'})\n`;
        context += `  - Lớp học: ${classes.length > 0 ? classes.join(', ') : 'Chưa tham gia lớp nào'}\n`;
      }

      context += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      return context;
    } catch (error) {
      this.logger.error('Error getting parent context:', error);
      return 'Không thể tải thông tin phụ huynh.';
    }
  }

  /**
   * Load or create conversation for user
   */
  private async getOrCreateConversation(
    userId: string,
    conversationId?: string,
  ): Promise<{ id: string; messages: string }> {
    try {
      if (conversationId) {
        // Load existing conversation
        const conversation = await this.prisma.agentConversation.findUnique({
          where: { id: conversationId, userId },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 10, // Last 10 messages for context
              select: {
                role: true,
                content: true,
              },
            },
          },
        });

        if (conversation) {
          const formattedMessages = conversation.messages
            .map((msg) => `${msg.role}: ${msg.content}`)
            .join('\n');

          return {
            id: conversation.id,
            messages: formattedMessages,
          };
        }
      }

      // Create new conversation
      const newConversation = await this.prisma.agentConversation.create({
        data: {
          userId,
          role: 'parent',
          title: 'Cuộc trò chuyện mới',
        },
      });

      return {
        id: newConversation.id,
        messages: '[NEW_CONVERSATION]',
      };
    } catch (error) {
      this.logger.error('Error managing conversation:', error);
      // Return empty conversation on error
      return { id: '', messages: '[NEW_CONVERSATION]' };
    }
  }

  /**
   * Save message to conversation history
   */
  private async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: any,
  ): Promise<void> {
    try {
      if (!conversationId) return;

      await this.prisma.agentMessage.create({
        data: {
          conversationId,
          role,
          content,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        },
      });

      // Update conversation title based on first user message
      if (role === 'user') {
        const messageCount = await this.prisma.agentMessage.count({
          where: { conversationId },
        });

        if (messageCount === 1) {
          // First message - use as title
          const title =
            content.length > 50 ? content.substring(0, 50) + '...' : content;
          await this.prisma.agentConversation.update({
            where: { id: conversationId },
            data: { title },
          });
        }
      }
    } catch (error) {
      this.logger.error('Error saving message:', error);
      // Don't throw - conversation history is non-critical
    }
  }

  async processQuery(message: string, userId: string, conversationId?: string) {
    // await this.ensureAgentReady();
    try {
      const startTime = Date.now();

      // Get personalized parent context
      const parentContext = await this.getParentContext(userId);

      // Load or create conversation
      const conversation = await this.getOrCreateConversation(
        userId,
        conversationId,
      );

      // Detect first message
      const isFirstMessage =
        !conversation.messages ||
        conversation.messages === '[NEW_CONVERSATION]' ||
        conversation.messages.length === 0;

      // Add tool hint for first message with statistical queries
      const toolHint =
        isFirstMessage && this.isStatisticsQuery(message)
          ? '\n\n⚠️ ĐÂY LÀ CÂU HỎI ĐẦU TIÊN - Hãy SỬ DỤNG CÔNG CỤ để trả lời chính xác. KHÔNG trả lời chung chung.'
          : '';

      // Enhance input with parent profile context
      const enhancedInput = `${parentContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 CÂU HỎI CỦA PHỤ HUYNH:
${message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${toolHint}

Hãy trả lời dựa trên thông tin con em ở trên. Nếu phụ huynh hỏi về con cụ thể, hãy sử dụng các tools để lấy thông tin chi tiết.`;

      const result = await this.agent.invoke({
        input: enhancedInput,
        chat_history:
          conversation.messages === '[NEW_CONVERSATION]'
            ? ''
            : conversation.messages,
        userId, // Pass userId to tools
      });

      const processingTime = Date.now() - startTime;

      // Extract tools used
      const toolsUsed =
        result.intermediateSteps?.map((step: any) => step.action?.tool) || [];

      // Save conversation to database
      await this.saveMessage(conversation.id, 'user', message);
      await this.saveMessage(conversation.id, 'assistant', result.output, {
        toolsUsed,
        processingTime,
      });

      return {
        answer: result.output,
        conversationId: conversation.id,
        toolsUsed,
        processingTime,
        executionSteps: result.intermediateSteps || [],
        reasoning: result.output,
        parentContext, // Include context in response for debugging
      };
    } catch (error) {
      this.logger.error('Error processing parent query:', error);
      throw error;
    }
  }

  async *streamQuery(
    message: string,
    userId: string,
    conversationId?: string,
  ): AsyncGenerator<{
    type: 'token' | 'tool' | 'complete' | 'error' | 'metadata' | 'chart';
    content?: string;
    tool?: string;
    toolInput?: any;
    data?: any;
    chart?: any;
  }> {
    // await this.ensureAgentReady();
    try {
      // Get personalized parent context
      const parentContext = await this.getParentContext(userId);

      // Load or create conversation
      const conversation = await this.getOrCreateConversation(
        userId,
        conversationId,
      );

      // Detect first message
      const isFirstMessage =
        !conversation.messages ||
        conversation.messages === '[NEW_CONVERSATION]' ||
        conversation.messages.length === 0;

      // Add tool hint for first message with statistical queries
      const toolHint =
        isFirstMessage && this.isStatisticsQuery(message)
          ? '\n\n ĐÂY LÀ CÂU HỎI ĐẦU TIÊN - Hãy SỬ DỤNG CÔNG CỤ để trả lời chính xác. KHÔNG trả lời chung chung.'
          : '';

      // Enhance input with parent profile context
      const enhancedInput = `${parentContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 CÂU HỎI CỦA PHỤ HUYNH:
${message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${toolHint}

Hãy trả lời dựa trên thông tin con em ở trên. Nếu phụ huynh hỏi về con cụ thể, hãy sử dụng các tools để lấy thông tin chi tiết.`;

      // Save user message
      await this.saveMessage(conversation.id, 'user', message);

      // Send metadata event with conversation id
      yield {
        type: 'metadata',
        data: { conversationId: conversation.id },
      };

      let fullResponse = '';
      let hasStreamedTokens = false;
      const toolsUsed = new Set<string>();

      // Use streamLog for better token-by-token streaming (same as admin agent)
      const stream = await this.agent.streamLog({
        input: enhancedInput,
        chat_history:
          conversation.messages === '[NEW_CONVERSATION]'
            ? ''
            : conversation.messages,
        userId,
      });

      for await (const chunk of stream) {
        // Handle LLM token streaming
        if (chunk.ops) {
          for (const op of chunk.ops) {
            if (op.op === 'add') {
              const path = op.path || '';

              // LLM streaming tokens
              if (path.includes('/streamed_output_str/-')) {
                const token = op.value;
                if (token && typeof token === 'string') {
                  fullResponse += token;
                  hasStreamedTokens = true;
                  yield { type: 'token', content: token };
                }
              }

              // Final output (after tool execution)
              if (path === '/streamed_output/-') {
                const value = op.value;
                let output = value?.output;

                if (output && typeof output === 'string') {
                  // Only manual tokenize if we DIDN'T get streaming tokens
                  if (!hasStreamedTokens) {
                    // Remove chart JSON blocks from text
                    output = output.replace(
                      /```json\s*\n?\{[^}]*"type":\s*"chart"[^}]*\}[^`]*```/gs,
                      '',
                    );
                    output = output.replace(
                      /\{[^}]*"type":\s*"chart"[^}]*"chartType":[^}]*\}/gs,
                      '',
                    );
                    output = output.trim();

                    if (output) {
                      // Manual tokenization: split by words
                      const words = output.split(/(\s+)/);
                      for (const word of words) {
                        if (word) {
                          fullResponse += word;
                          yield { type: 'token', content: word };
                          await new Promise((resolve) =>
                            setTimeout(resolve, 10),
                          );
                        }
                      }
                    }
                  } else {
                    fullResponse = output;
                  }
                }
              }

              // Tool calls
              if (path.includes('/actions/-')) {
                const action = op.value;
                if (action?.tool) {
                  toolsUsed.add(action.tool);
                  yield {
                    type: 'tool',
                    tool: action.tool,
                    toolInput: action.toolInput,
                  };
                }
              }

              // Check for chart_generator result
              if (path.includes('/logs/') && op.value) {
                const logValue = op.value;
                if (
                  logValue.name === 'chart_generator' &&
                  logValue.type === 'tool_end'
                ) {
                  try {
                    const chartResult = JSON.parse(logValue.output || '{}');
                    if (chartResult.success && chartResult.chart) {
                      yield { type: 'chart', chart: chartResult.chart };
                    }
                  } catch (e) {
                    this.logger.warn('Failed to parse chart result:', e);
                  }
                }

                // Check for analytics tools (multiple charts)
                const analyticsTools = [
                  'get_child_progress',
                  'compare_children',
                  'get_children_summary',
                ];
                if (
                  analyticsTools.includes(logValue.name) &&
                  logValue.type === 'tool_end'
                ) {
                  try {
                    const result = JSON.parse(logValue.output || '{}');
                    if (result.charts && Array.isArray(result.charts)) {
                      for (const chart of result.charts) {
                        yield { type: 'chart', chart };
                      }
                    }
                  } catch (e) {
                    this.logger.warn('Failed to parse analytics result:', e);
                  }
                }
              }
            }
          }
        }
      }

      // Handle empty response (likely rate limiting or model error)
      if (!fullResponse || fullResponse.trim() === '') {
        this.logger.warn(
          '⚠️ Empty response received - possible rate limiting or model error',
        );
        fullResponse =
          'Xin lỗi, hiện tại hệ thống đang quá tải. Vui lòng thử lại sau vài giây.';
      }

      // Send complete event with final answer
      yield {
        type: 'complete',
        data: {
          answer: fullResponse,
          toolsUsed: Array.from(toolsUsed),
          conversationId: conversation.id,
        },
      };

      // Save assistant response after streaming completes
      if (fullResponse) {
        await this.saveMessage(conversation.id, 'assistant', fullResponse);
      }
    } catch (error) {
      this.logger.error('Error streaming parent query:', error);

      const errorMessage = (error as Error).message || '';
      let userFriendlyMessage = 'Đã xảy ra lỗi khi xử lý yêu cầu';

      if (
        errorMessage.includes('429') ||
        errorMessage.includes('RESOURCE_EXHAUSTED')
      ) {
        userFriendlyMessage =
          'Hệ thống AI đang quá tải. Vui lòng thử lại sau 30 giây.';
      }

      yield {
        type: 'error',
        content: userFriendlyMessage,
      };
    }
  }
}
