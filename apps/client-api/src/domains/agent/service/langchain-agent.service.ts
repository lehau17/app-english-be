import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChartGeneratorTool } from '../tools/chart-generator.tool';
import { ExcelExportTool } from '../tools/excel-export.tool';
import { GraphQueryTool } from '../tools/graph-query.tool';
import { PdfExportTool } from '../tools/pdf-export.tool';
import { RagTool } from '../tools/rag.tool';
import { ReportAdvisorTool } from '../tools/report-advisor.tool';
import { SqlTool } from '../tools/sql.tool';
import { StudentAgentTools } from '../tools/student-agent.tools';
import { WordExportTool } from '../tools/word-export.tool';
import { RagService } from './rag.service';
import { SqlService } from './sql.service';

@Injectable()
export class LangChainAgentService {
  private readonly logger = new Logger(LangChainAgentService.name);
  private agent!: AgentExecutor;

  constructor(
    private ragService: RagService,
    private sqlService: SqlService,
    private chartGenerator: ChartGeneratorTool,
    private excelExport: ExcelExportTool,
    private pdfExport: PdfExportTool,
    private wordExport: WordExportTool,
    private reportAdvisor: ReportAdvisorTool,
    private graphQuery: GraphQueryTool,
    private studentTools: StudentAgentTools,
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

      // Tools will be determined based on user role at runtime
      // For now, initialize with default tools
      const tools = [
        new RagTool(this.ragService),
        new SqlTool(this.sqlService),
        this.graphQuery,
        this.chartGenerator,
        this.excelExport,
        this.pdfExport,
        this.wordExport,
        this.reportAdvisor,
      ];

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `
Bạn là trợ lý AI thông minh hỗ trợ người dùng với vai trò: {user_role}

👤 THÔNG TIN NGƯỜI DÙNG HIỆN TẠI:
{user_info}

🎯 NHIỆM VỤ THEO VAI TRÒ:

**Nếu {user_role} = "student" (Học sinh):**
- Hỗ trợ học tập và tiến độ cá nhân
- Kiểm tra bài tập, điểm số, thành tích
- Gợi ý bài học phù hợp
- Giải thích từ vựng, ngữ pháp
- Động viên và khuyến khích học tập
- KHÔNG được thực hiện tác vụ admin (chấm điểm, quản lý lớp)

**Nếu {user_role} = "parent" (Phụ huynh):**
- Theo dõi tiến độ học tập của con em
- Xem lịch học và điểm danh
- Kiểm tra thanh toán học phí
- Nhận thông báo từ giáo viên
- Xem báo cáo tổng quan về con
- KHÔNG được thực hiện tác vụ của học sinh hoặc giáo viên

**Nếu {user_role} = "teacher" (Giáo viên):**
- Quản lý lớp học và học sinh
- Xem danh sách và thống kê lớp
- Thống kê điểm và tiến độ học sinh
- Tạo thông báo cho lớp
- Export dữ liệu lớp học
- KHÔNG được thực hiện tác vụ admin cấp cao (quản lý hệ thống)

**Nếu {user_role} = "admin" hoặc khác:**
- Quyền truy cập đầy đủ tất cả chức năng
- Thống kê toàn hệ thống
- Quản lý dữ liệu cấp cao
- Export báo cáo tổng hợp

🛠️ CÔNG CỤ CÓ SẴN:

1. **knowledge_search**: Tra cứu knowledge base (quy định/FAQ/khóa học/bài học/từ vựng/hoạt động/nội dung học tập)
2. **database_query**: Truy vấn cơ sở dữ liệu (SELECT only) để lấy thống kê, danh sách học viên, điểm số, v.v.
3. **chart_generator**: Tạo biểu đồ trực quan từ dữ liệu (bar/line/pie/area/radar)
4. **excel_export**: Xuất dữ liệu ra file Excel (.xlsx) với styling chuyên nghiệp
5. **pdf_export**: Xuất báo cáo ra file PDF (.pdf) chính thức, dễ in ấn
6. **word_export**: Xuất báo cáo ra file Word (.docx) chi tiết, dễ chỉnh sửa
7. **report_advisor**: Phân tích dữ liệu và gợi ý format báo cáo phù hợp nhất (PDF/Word/Excel)

**QUY TẮC SỬ DỤNG:**

🔍 **Khi người dùng hỏi về nội dung/kiến thức:**
   → Dùng knowledge_search để tìm thông tin về khóa học, bài học, từ vựng, hoạt động
   → Ví dụ: "Khóa học IELTS có gì?", "Bài học về thì hiện tại", "Từ vựng chủ đề du lịch"

📊 **Khi người dùng hỏi về dữ liệu/thống kê:**
   → Dùng database_query để lấy dữ liệu từ DB
   → Ví dụ: "10 học viên điểm cao nhất", "Số lượng học viên mới", "Thống kê điểm danh"
   → **HỖ TRỢ ĐẦY ĐỦ:**
     • Truy vấn theo thời gian: NOW(), INTERVAL '2 months', DATE_TRUNC('week', ...)
     • Group by time: GROUP BY DATE_TRUNC('day/week/month/year', "createdAt")
     • Aggregate: COUNT, SUM, AVG, MIN, MAX
     • Window functions, CTEs (WITH), subqueries đều OK
     • Lọc theo khoảng thời gian bất kỳ: ngày, tuần, tháng, năm
   → **VÍ DỤ:** "4 tuần gần nhất" = WHERE "createdAt" >= NOW() - INTERVAL '4 weeks'

📈 **Khi người dùng yêu cầu biểu đồ:**
   1. Lấy dữ liệu bằng database_query
   2. GỌI chart_generator với dữ liệu đã có
   3. **QUAN TRỌNG:** KHÔNG viết lại chart JSON trong response!
   4. CHỈ NÓI: "Biểu đồ đã được tạo" + giải thích ngắn về dữ liệu
   → Tool tự động gửi chart config đến frontend

📄 **Khi người dùng yêu cầu xuất báo cáo (Excel/PDF/Word):**

   **CÁC 1: Người dùng không chỉ định format:**
   1. Lấy dữ liệu bằng database_query
   2. GỌI report_advisor để phân tích và gợi ý format phù hợp
   3. Giải thích lý do gợi ý format đó
   4. Hỏi người dùng có muốn xuất theo format gợi ý không (hoặc chọn format khác)
   5. GỌI tool export tương ứng (excel_export/pdf_export/word_export)

   **CÁCH 2: Người dùng chỉ định format rõ ràng:**
   1. Lấy dữ liệu bằng database_query
   2. GỌI tool export tương ứng trực tiếp:
      - "xuất Excel" → excel_export
      - "xuất PDF" → pdf_export
      - "xuất Word" → word_export
   3. **SAU KHI GỌI TOOL:** CHỈ NÓI: "Tôi đã tạo file [format] với [số lượng] bản ghi."
   4. **TUYỆT ĐỐI KHÔNG** viết link download, URL, hoặc markdown link vào response
   5. **HỆ THỐNG SẼ TỰ ĐỘNG** hiển thị nút download cho người dùng

   **GỢI Ý FORMAT:**
   - Excel: Dữ liệu bảng lớn (>100 rows), cần phân tích/tính toán
   - PDF: Báo cáo chính thức (<50 rows), cần in ấn/lưu trữ
   - Word: Báo cáo chi tiết/phức tạp, nhiều trường (>15 columns)

**LƯU Ý:**
- Luôn dùng database_query để lấy dữ liệu thực từ DB, KHÔNG bịa số liệu
- Trả lời ngắn gọn bằng Markdown
- Khi query DB, sử dụng tên bảng và cột chính xác từ schema
- Giải thích rõ ràng dữ liệu đến từ đâu
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
    userRole: string = 'student',
    userInfo: string = '',
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
      user_role: userRole, // Pass role to prompt
      user_info: userInfo, // Pass user info to prompt
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
    userRole: string = 'student',
    userInfo: string = '',
  ): AsyncGenerator<{
    type: 'token' | 'tool' | 'complete' | 'error' | 'chart' | 'file';
    content?: string;
    tool?: string;
    toolInput?: any;
    data?: any;
    chart?: any;
    file?: any;
  }> {
    const start = Date.now();

    try {
      this.logger.debug(
        `🌊 Starting stream for: "${question}" [Role: ${userRole}]`,
      );

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
      let steps: any[] = [];
      let finalIntermediateSteps: any[] = [];
      let hasStreamedTokens = false; // Track if we got real-time tokens

      // Use streamLog instead of stream for better token-by-token streaming
      const stream = await this.agent.streamLog({
        input: question,
        chat_history: formattedHistory,
        user_role: userRole, // Pass role to prompt
        user_info: userInfo, // Pass user info to prompt
      });

      for await (const chunk of stream) {
        this.logger.debug(
          '📦 Stream chunk:',
          JSON.stringify(chunk).substring(0, 200),
        );

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
                  hasStreamedTokens = true; // Mark that we got streaming tokens
                  yield { type: 'token', content: token };
                }
              }

              // Final output (after tool execution) - only tokenize if we didn't stream
              if (path === '/streamed_output/-') {
                const value = op.value;
                let output = value?.output;

                // Capture intermediate steps from final output
                if (
                  value?.intermediateSteps &&
                  Array.isArray(value.intermediateSteps)
                ) {
                  this.logger.log(
                    `🎯 Found ${value.intermediateSteps.length} intermediate steps in final output!`,
                  );
                  finalIntermediateSteps = value.intermediateSteps;
                }

                if (output && typeof output === 'string') {
                  this.logger.debug(
                    `📝 Final output: "${output.substring(0, 100)}..."`,
                  );
                  this.logger.debug(
                    `📊 Has streamed tokens: ${hasStreamedTokens}`,
                  );

                  // Only manual tokenize if we DIDN'T get streaming tokens (avoid duplicate)
                  if (!hasStreamedTokens) {
                    // Remove chart JSON blocks from text (AI sometimes includes them in response)
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
                      this.logger.log(
                        '🔄 Manual tokenization (no streaming tokens received)',
                      );
                      // Manual tokenization: split by words and stream word-by-word
                      const words = output.split(/(\s+)/); // Keep whitespace
                      for (const word of words) {
                        if (word) {
                          fullAnswer += word;
                          yield { type: 'token', content: word };
                          await new Promise((resolve) =>
                            setTimeout(resolve, 10),
                          );
                        }
                      }
                    }
                  } else {
                    this.logger.log(
                      '✅ Skipping manual tokenization (already streamed)',
                    );
                    // Just update fullAnswer to match what was streamed
                    fullAnswer = output;
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

              // Tool results (check for chart_generator and excel_export output)
              if (path.includes('/logs/') && op.value) {
                const logValue = op.value;
                this.logger.debug(
                  `🔍 Log value: ${JSON.stringify(logValue).substring(0, 300)}`,
                );

                // Check if this is chart_generator result
                if (
                  logValue.name === 'chart_generator' &&
                  logValue.type === 'tool_end'
                ) {
                  try {
                    const chartResult = JSON.parse(logValue.output || '{}');
                    this.logger.debug(
                      `📊 Parsed chart result: ${JSON.stringify(chartResult).substring(0, 300)}`,
                    );

                    if (chartResult.success && chartResult.chart) {
                      this.logger.log('✅ Chart detected, sending chart chunk');
                      yield {
                        type: 'chart',
                        chart: chartResult.chart,
                      };
                    }
                  } catch (e) {
                    this.logger.warn('⚠️ Failed to parse chart result:', e);
                  }
                }

                // Check if this is excel_export result
                if (
                  logValue.name === 'excel_export' &&
                  logValue.type === 'tool_end'
                ) {
                  try {
                    const fileResult = JSON.parse(logValue.output || '{}');
                    this.logger.debug(
                      `📄 Parsed file result: ${JSON.stringify(fileResult).substring(0, 300)}`,
                    );

                    if (fileResult.success && fileResult.downloadUrl) {
                      this.logger.log(
                        '✅ Excel file detected, sending file chunk',
                      );
                      yield {
                        type: 'file',
                        file: {
                          filename: fileResult.filename,
                          downloadUrl: fileResult.downloadUrl,
                          recordCount: fileResult.recordCount,
                        },
                      };
                    }
                  } catch (e) {
                    this.logger.warn('⚠️ Failed to parse file result:', e);
                  }
                }
              }

              // Also check tool results in actions path
              if (path.includes('/actions/') && op.value?.output) {
                try {
                  const toolResult =
                    typeof op.value.output === 'string'
                      ? JSON.parse(op.value.output)
                      : op.value.output;

                  if (toolResult.success && toolResult.chart) {
                    this.logger.log('📊 Chart found in action result!');
                    yield {
                      type: 'chart',
                      chart: toolResult.chart,
                    };
                  }
                } catch (e) {
                  // Not a chart result, ignore
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

      this.logger.log(
        `✅ Streaming complete. Total length: ${fullAnswer.length}`,
      );
      this.logger.log(`📝 Full answer content: "${fullAnswer}"`);

      // Use finalIntermediateSteps if steps is empty
      if (steps.length === 0 && finalIntermediateSteps.length > 0) {
        this.logger.log(
          `🔄 Using finalIntermediateSteps: ${finalIntermediateSteps.length} steps`,
        );
        steps = finalIntermediateSteps;
      }

      this.logger.log(`🔍 Total steps: ${steps.length}`);

      // Check for chart in intermediate steps (fallback if not detected during streaming)
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        this.logger.log(
          `📋 Step ${i}: tool=${step.action?.tool}, has observation=${!!step.observation}`,
        );

        if (step.action?.tool === 'chart_generator') {
          this.logger.log(`🎯 Found chart_generator step!`);
          this.logger.log(
            `📊 Observation: ${JSON.stringify(step.observation).substring(0, 500)}`,
          );

          if (step.observation) {
            try {
              const chartResult =
                typeof step.observation === 'string'
                  ? JSON.parse(step.observation)
                  : step.observation;

              this.logger.log(
                `✅ Parsed result:`,
                JSON.stringify(chartResult).substring(0, 300),
              );

              if (chartResult.success && chartResult.chart) {
                this.logger.log('� Sending chart chunk NOW!');
                yield {
                  type: 'chart',
                  chart: chartResult.chart,
                };
              } else {
                this.logger.warn('⚠️ Chart result missing success/chart field');
              }
            } catch (e) {
              this.logger.error('❌ Failed to parse chart from step:', e);
            }
          }
        }

        // ✅ Detect all file export tools (Excel, PDF, Word)
        const isFileExportTool = [
          'excel_export',
          'pdf_export',
          'word_export',
        ].includes(step.action?.tool);

        if (isFileExportTool) {
          this.logger.log(`🎯 Found ${step.action?.tool} step!`);
          this.logger.log(
            `📄 Observation: ${JSON.stringify(step.observation).substring(0, 500)}`,
          );

          if (step.observation) {
            try {
              const fileResult =
                typeof step.observation === 'string'
                  ? JSON.parse(step.observation)
                  : step.observation;

              this.logger.log(
                `✅ Parsed file result:`,
                JSON.stringify(fileResult).substring(0, 300),
              );

              if (fileResult.success && fileResult.downloadUrl) {
                this.logger.log(
                  `📄 Sending file chunk for ${step.action?.tool}!`,
                );
                yield {
                  type: 'file',
                  file: {
                    filename: fileResult.filename,
                    downloadUrl: fileResult.downloadUrl,
                    recordCount: fileResult.recordCount,
                  },
                };
              } else {
                this.logger.warn(
                  '⚠️ File result missing success/downloadUrl field',
                );
              }
            } catch (e) {
              this.logger.error('❌ Failed to parse file from step:', e);
            }
          }
        }
      }

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
