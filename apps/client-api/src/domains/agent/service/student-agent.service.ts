import { PrismaRepository } from '@app/database';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { StudentAgentTools } from '../tools/student-agent.tools';
import { RagService } from './rag.service';
import { SqlService } from './sql.service';

@Injectable()
export class StudentAgentService {
  private readonly logger = new Logger(StudentAgentService.name);
  private agent!: AgentExecutor;
  private agentReady: Promise<void>;

  constructor(
    private prisma: PrismaRepository,
    private ragService: RagService,
    private sqlService: SqlService,
    private studentTools: StudentAgentTools,
  ) {
    this.agentReady = this.initializeAgent();
  }

  private async initializeAgent() {
    const startTime = Date.now();
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

NHIỆM VỤ:
- Hỗ trợ học sinh theo dõi tiến độ học tập
- Kiểm tra bài tập đã nộp/chưa nộp
- Gợi ý bài học tiếp theo
- Xem điểm số và thành tích
- Tìm podcast, listening exercises
- Giải thích từ vựng, ngữ pháp
- Động viên và khuyến khích học tập

CÔNG CỤ:
1. **knowledge_search**: Tra cứu kiến thức (từ vựng, ngữ pháp, khóa học, bài học)
2. **database_query**: Truy vấn dữ liệu (assignments, progress, scores)
3. **get_my_assignments**: Lấy danh sách bài tập của học sinh
4. **get_my_progress**: Xem tiến độ học tập
5. **find_lessons**: Tìm bài học theo chủ đề
6. **get_leaderboard**: Xem bảng xếp hạng

QUAN TRỌNG - KHI SỬ DỤNG CÔNG CỤ:
- Câu hỏi về "thống kê", "danh sách", "báo cáo" → LUÔN dùng database_query hoặc knowledge_search
- Câu hỏi về "tiến độ", "điểm số", "bài tập" → LUÔN dùng get_my_progress hoặc get_my_assignments
- NẾU đây là câu hỏi đầu tiên (chat_history trống) VÀ có từ khóa trên → BẮT BUỘC gọi tool, KHÔNG trả lời trực tiếp
- Nếu không có dữ liệu học tập → gợi ý học sinh bắt đầu học

QUY TẮC:
- Luôn thân thiện, khuyến khích
- Trả lời bằng tiếng Việt (trừ khi học sinh yêu cầu tiếng Anh)
- Động viên khi học sinh gặp khó khăn
- Gợi ý cách học hiệu quả
- KHÔNG thực hiện các tác vụ của admin (chấm điểm, quản lý lớp)

CÁCH TRẢ LỜI:
- Ngắn gọn, rõ ràng
- Sử dụng emoji phù hợp
- Cung cấp action items cụ thể
- Đề xuất các bước tiếp theo

📋 ĐỊNH DẠNG BẢNG (BẮT BUỘC):
Khi trình bày danh sách (bài tập, điểm số, từ vựng, v.v.), **LUÔN DÙNG BẢNG MARKDOWN**:

| STT | Bài tập | Điểm | Trạng thái |
|-----|---------|------|------------|
| 1 | Unit 1 Test | 8.5 | Hoàn thành |

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
      this.logger.log(
        `Student Agent initialized successfully in ${initTime}ms`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize Student Agent:', error);
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
      'học sinh',
      'student',
    ];

    const lowerMessage = message.toLowerCase();
    return keywords.some((keyword) => lowerMessage.includes(keyword));
  }

  /**
   * Get personalized student context for AI agent
   */
  private async getStudentContext(userId: string): Promise<string> {
    try {
      const profile = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          displayName: true,
          assignmentSubmissions: {
            where: { score: { not: null } },
            orderBy: { submittedAt: 'desc' },
            take: 10,
            select: {
              score: true,
              submittedAt: true,
              assignment: {
                select: {
                  title: true,
                  totalPoints: true,
                },
              },
            },
          },
          classroomsStudying: {
            select: {
              classroom: {
                select: {
                  name: true,
                  course: {
                    select: { title: true },
                  },
                },
              },
            },
          },
          savedWords: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { word: true, createdAt: true },
          },
        },
      });

      if (!profile) {
        return 'Học sinh mới, chưa có dữ liệu học tập.';
      }

      // Calculate statistics
      const avgScore = this.calculateAvgScore(profile.assignmentSubmissions);
      const weakTopics = this.analyzeWeakTopics(profile.assignmentSubmissions);
      const learningStreak = await this.calculateStreak(userId);
      const totalSubmissions = profile.assignmentSubmissions.length;
      const courses = profile.classroomsStudying
        .map((cs) => cs.classroom.course.title)
        .filter((v, i, a) => a.indexOf(v) === i); // unique

      const studentName =
        profile.displayName ||
        `${profile.firstName || ''} ${profile.lastName || ''}`.trim() ||
        'Học sinh';

      // Build context string
      let context = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HỒ SƠ HỌC SINH: ${studentName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THỐNG KÊ HỌC TẬP:
• Điểm trung bình: ${avgScore.toFixed(1)}/100 ${this.getScoreEmoji(avgScore)}
• Số bài đã nộp: ${totalSubmissions}
• Chuỗi học: ${learningStreak} ngày ${learningStreak >= 7 ? '🔥' : ''}
• Khóa học: ${courses.length > 0 ? courses.join(', ') : 'Chưa tham gia khóa nào'}
`;

      // Weak topics analysis
      if (weakTopics.length > 0) {
        context += `\nCHỦ ĐỀ CẦN CẢI THIỆN:\n`;
        weakTopics.forEach((topic) => {
          context += `  • ${topic.topic}: ${topic.avgScore.toFixed(1)}/100\n`;
        });
      }

      // Recent vocabulary
      if (profile.savedWords.length > 0) {
        context += `\n📖 TỪ VỰNG GẦN ĐÂY:\n`;
        profile.savedWords.forEach((word) => {
          context += `  • ${word.word}\n`;
        });
      }

      // Learning insights
      context += this.generateLearningInsights(
        avgScore,
        learningStreak,
        totalSubmissions,
      );

      context += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      return context;
    } catch (error) {
      this.logger.error('Error getting student context:', error);
      return 'Không thể tải hồ sơ học sinh.';
    }
  }

  /**
   * Calculate average score from submissions
   */
  private calculateAvgScore(
    submissions: Array<{ score: number; assignment: { totalPoints: number } }>,
  ): number {
    if (submissions.length === 0) return 0;

    const percentages = submissions.map(
      (s) => (s.score / s.assignment.totalPoints) * 100,
    );
    return percentages.reduce((a, b) => a + b, 0) / percentages.length;
  }

  /**
   * Analyze weak topics based on assignment performance
   */
  private analyzeWeakTopics(
    submissions: Array<{
      score: number;
      assignment: { totalPoints: number; title: string };
    }>,
  ): Array<{ topic: string; avgScore: number; count: number }> {
    if (submissions.length === 0) return [];

    // Group by assignment title as topic
    const topicMap = new Map<string, { totalScore: number; count: number }>();

    submissions.forEach((sub) => {
      const topic = sub.assignment.title || 'Chủ đề khác';
      const percentage = (sub.score / sub.assignment.totalPoints) * 100;

      if (!topicMap.has(topic)) {
        topicMap.set(topic, { totalScore: 0, count: 0 });
      }

      const data = topicMap.get(topic)!;
      data.totalScore += percentage;
      data.count += 1;
    });

    // Calculate averages and filter weak topics (< 70%)
    const weakTopics = Array.from(topicMap.entries())
      .map(([topic, data]) => ({
        topic,
        avgScore: data.totalScore / data.count,
        count: data.count,
      }))
      .filter((t) => t.avgScore < 70)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 3); // Top 3 weakest

    return weakTopics;
  }

  /**
   * Calculate learning streak (consecutive days with activity)
   */
  private async calculateStreak(userId: string): Promise<number> {
    try {
      const submissions = await this.prisma.assignmentSubmission.findMany({
        where: { studentId: userId },
        orderBy: { submittedAt: 'desc' },
        select: { submittedAt: true },
      });

      if (submissions.length === 0) return 0;

      let streak = 0;
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      const submissionDates = new Set(
        submissions.map((s) => {
          const d = new Date(s.submittedAt);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        }),
      );

      // Count consecutive days backwards from today
      while (submissionDates.has(currentDate.getTime())) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      }

      return streak;
    } catch (error) {
      this.logger.error('Error calculating streak:', error);
      return 0;
    }
  }

  /**
   * Get emoji based on score
   */
  private getScoreEmoji(score: number): string {
    if (score >= 90) return '🌟';
    if (score >= 80) return '🎉';
    if (score >= 70) return '👍';
    if (score >= 60) return '📈';
    return '💪';
  }

  /**
   * Generate learning insights based on stats
   */
  private generateLearningInsights(
    avgScore: number,
    streak: number,
    totalSubmissions: number,
  ): string {
    let insights = '\nNHẬN XÉT:\n';

    // Score-based insights
    if (avgScore >= 80) {
      insights += '  Kết quả học tập rất tốt! Tiếp tục phát huy!\n';
    } else if (avgScore >= 60) {
      insights += '  Đang học khá tốt. Hãy ôn tập thêm để đạt điểm cao hơn!\n';
    } else if (avgScore > 0) {
      insights +=
        '  💪 Cần cố gắng thêm. Đừng ngại hỏi thầy cô khi gặp khó khăn!\n';
    }

    // Streak-based insights
    if (streak >= 7) {
      insights += '  Streak ấn tượng! Bạn đang học rất đều đặn!\n';
    } else if (streak >= 3) {
      insights += '  ⭐ Đang duy trì tốt! Cố gắng giữ vững nhé!\n';
    } else if (totalSubmissions > 0) {
      insights += '  📅 Thử học đều đặn mỗi ngày để tạo thói quen tốt!\n';
    }

    // Activity-based insights
    if (totalSubmissions === 0) {
      insights += '  Hãy bắt đầu làm bài tập để xây dựng nền tảng!\n';
    }

    return insights;
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
          role: 'student',
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

      // Get personalized student context
      const studentContext = await this.getStudentContext(userId);

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

      // Enhance input with student profile context
      const enhancedInput = `${studentContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 CÂU HỎI CỦA HỌC SINH:
${message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${toolHint}

Hãy trả lời dựa trên hồ sơ học tập của học sinh ở trên. Nếu học sinh có điểm yếu, hãy gợi ý cụ thể. Nếu học sinh đang làm tốt, hãy động viên và khuyến khích tiếp tục.`;

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
        reasoning: result.output, // Could extract reasoning from steps
        studentContext, // Include context in response for debugging
      };
    } catch (error) {
      this.logger.error('Error processing student query:', error);
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
      // Get personalized student context
      const studentContext = await this.getStudentContext(userId);

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

      // Enhance input with student profile context
      const enhancedInput = `${studentContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 CÂU HỎI CỦA HỌC SINH:
${message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${toolHint}

Hãy trả lời dựa trên hồ sơ học tập của học sinh ở trên. Nếu học sinh có điểm yếu, hãy gợi ý cụ thể. Nếu học sinh đang làm tốt, hãy động viên và khuyến khích tiếp tục.`;

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
                  'get_score_report',
                  'learning_analytics',
                  'track_progress',
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
      this.logger.error('Error streaming student query:', error);

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

  /**
   * Get learning analytics directly (without going through agent chat)
   */
  async getLearningAnalytics(
    userId: string,
    timeRange: 'week' | 'month' | 'quarter' | 'year' | 'all-time' = 'month',
    includeCharts: boolean = true,
    includePrediction: boolean = true,
  ) {
    try {
      // Get the learning analytics tool from student tools
      const tools = this.studentTools.getTools();
      const analyticsTool = tools.find((t) => t.name === 'learning_analytics');

      if (!analyticsTool) {
        throw new Error('Learning analytics tool not found');
      }

      // Call the tool directly
      const result = await (analyticsTool as any)._call({
        userId,
        timeRange,
        includeCharts,
        includePrediction,
      });

      // Parse JSON response
      const parsed = JSON.parse(result);
      return parsed;
    } catch (error) {
      this.logger.error('Error getting learning analytics:', error);
      throw error;
    }
  }
}
