import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { AssignmentAnalyticsTool } from '../tools/assignment-analytics.tool';
import { AttendanceReportTool } from '../tools/attendance-report.tool';
import { ChartGeneratorTool } from '../tools/chart-generator.tool';
import { ClassPerformanceTool } from '../tools/class-performance.tool';
import { ClassroomAnalyticsTool } from '../tools/classroom-analytics.tool';
import { ContentStatsTool } from '../tools/content-stats.tool';
import { CourseAnalyticsTool } from '../tools/course-analytics.tool';
import { ExcelExportTool } from '../tools/excel-export.tool';
import { FlashcardReviewTool } from '../tools/flashcard-review.tool';
import { GrammarExplainerTool } from '../tools/grammar-explainer.tool';
import { GraphQueryTool } from '../tools/graph-query.tool';
import { NotificationSenderTool } from '../tools/notification-sender.tool';
import { PaymentTrackerTool } from '../tools/payment-tracker.tool';
import { PdfExportTool } from '../tools/pdf-export.tool';
import { PodcastHistoryTool } from '../tools/podcast-history.tool';
import { ProgressTrackerTool } from '../tools/progress-tracker.tool';
import { RagTool } from '../tools/rag.tool';
import { ReportAdvisorTool } from '../tools/report-advisor.tool';
import { RevenueAnalyticsTool } from '../tools/revenue-analytics.tool';
import { SpeakingProgressTool } from '../tools/speaking-progress.tool';
import { SqlTool } from '../tools/sql.tool';
import { StudentAgentTools } from '../tools/student-agent.tools';
import { StudentAlertTool } from '../tools/student-alert.tool';
import { StudentAnalyticsTool } from '../tools/student-analytics.tool';
import { SystemOverviewTool } from '../tools/system-overview.tool';
import { TeacherAnalyticsTool } from '../tools/teacher-analytics.tool';
import { UpcomingDeadlinesTool } from '../tools/upcoming-deadlines.tool';
import { UserManagementTool } from '../tools/user-management.tool';
import { VocabularyLookupTool } from '../tools/vocabulary-lookup.tool';
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
    private studentAnalytics: StudentAnalyticsTool,
    private teacherAnalytics: TeacherAnalyticsTool,
    private courseAnalytics: CourseAnalyticsTool,
    private classroomAnalytics: ClassroomAnalyticsTool,
    private classPerformance: ClassPerformanceTool,
    private revenueAnalytics: RevenueAnalyticsTool,
    private systemOverview: SystemOverviewTool,
    private notificationSender: NotificationSenderTool,
    private assignmentAnalytics: AssignmentAnalyticsTool,
    private progressTracker: ProgressTrackerTool,
    private podcastHistory: PodcastHistoryTool,
    private studentAlert: StudentAlertTool,
    private userManagement: UserManagementTool,
    private contentStats: ContentStatsTool,
    private vocabularyLookup: VocabularyLookupTool,
    private grammarExplainer: GrammarExplainerTool,
    private flashcardReview: FlashcardReviewTool,
    private upcomingDeadlines: UpcomingDeadlinesTool,
    private attendanceReport: AttendanceReportTool,
    private speakingProgress: SpeakingProgressTool,
    private paymentTracker: PaymentTrackerTool,
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
      // Note: Tools with Prisma injection must use .getTool() pattern
      const tools = [
        new RagTool(this.ragService),
        new SqlTool(this.sqlService),
        this.graphQuery,
        this.chartGenerator,
        this.excelExport,
        this.pdfExport,
        this.wordExport,
        this.reportAdvisor.getTool(),
        this.studentAnalytics.getTool(),
        this.teacherAnalytics.getTool(),
        this.courseAnalytics.getTool(),
        this.classroomAnalytics.getTool(),
        this.classPerformance.getTool(),
        this.revenueAnalytics.getTool(),
        this.systemOverview.getTool(),
        this.notificationSender.getTool(),
        this.assignmentAnalytics.getTool(),
        this.progressTracker.getTool(),
        this.podcastHistory.getTool(),
        this.studentAlert.getTool(),
        this.userManagement.getTool(),
        this.contentStats.getTool(),
        // Student learning tools
        this.vocabularyLookup.getTool(),
        this.grammarExplainer.getTool(),
        ...this.flashcardReview.getTools(), // FlashcardReviewTool returns 5 tools
        this.upcomingDeadlines.getTool(),
        ...this.attendanceReport.getTools(), // AttendanceReportTool returns 4 tools
        ...this.speakingProgress.getTools(), // SpeakingProgressTool returns 4 tools
        ...this.paymentTracker.getTools(), // PaymentTrackerTool returns 4 tools
      ];

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `
Bạn là trợ lý AI thông minh hỗ trợ người dùng với vai trò: {user_role}

THÔNG TIN NGƯỜI DÙNG HIỆN TẠI:
{user_info}

NHIỆM VỤ THEO VAI TRÒ:

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

CÔNG CỤ CÓ SẴN:

1. **knowledge_search**: Tra cứu knowledge base (quy định/FAQ/khóa học/bài học/từ vựng/hoạt động/nội dung học tập)
2. **database_query**: Truy vấn cơ sở dữ liệu (SELECT only) để lấy thống kê, danh sách học viên, điểm số, v.v.
3. **chart_generator**: Tạo biểu đồ trực quan từ dữ liệu (bar/line/pie/area/radar)
4. **excel_export**: Xuất dữ liệu ra file Excel (.xlsx) với styling chuyên nghiệp
5. **pdf_export**: Xuất báo cáo ra file PDF (.pdf) chính thức, dễ in ấn
6. **word_export**: Xuất báo cáo ra file Word (.docx) chi tiết, dễ chỉnh sửa
7. **report_advisor**: Phân tích dữ liệu và gợi ý format báo cáo phù hợp nhất (PDF/Word/Excel)
8. **analyze_student**: Phân tích chi tiết học viên với AI - điểm số, kỹ năng, xu hướng, gợi ý cải thiện + TẠO NHIỀU BIỂU ĐỒ
9. **analyze_teacher**: Phân tích hiệu suất giảng dạy của giáo viên - lớp học, học viên, điểm TB + TẠO NHIỀU BIỂU ĐỒ
10. **analyze_course**: Phân tích khóa học - enrollment, completion rate, điểm TB, so sánh các khóa + TẠO NHIỀU BIỂU ĐỒ
11. **analyze_classroom**: Phân tích lớp học - học viên, attendance, điểm TB, cảnh báo lớp cần can thiệp + TẠO NHIỀU BIỂU ĐỒ
12. **analyze_revenue**: Phân tích doanh thu - theo tháng, theo khóa, tỷ lệ thanh toán, dự báo + TẠO NHIỀU BIỂU ĐỒ
13. **system_overview**: Tổng quan hệ thống - users, courses, classrooms, hoạt động gần đây + TẠO NHIỀU BIỂU ĐỒ
14. **send_notification**: Gửi thông báo cho user/role/lớp/khóa học
15. **analyze_assignment**: Phân tích bài tập - tỷ lệ nộp bài, điểm TB, bài khó, học sinh chưa nộp + TẠO NHIỀU BIỂU ĐỒ
16. **track_progress**: Theo dõi tiến độ học tập cá nhân - khóa học, từ vựng, podcast, speaking, bài tập + TẠO NHIỀU BIỂU ĐỒ (dành cho student)

**CÔNG CỤ HỌC TẬP CHO HỌC SINH (Student Learning Tools):**
17. **lookup_vocabulary**: Tra cứu từ vựng chi tiết - phát âm, định nghĩa, ví dụ, từ đồng nghĩa/trái nghĩa, bài tập thực hành
18. **explain_grammar**: Giải thích ngữ pháp - quy tắc, ví dụ, lỗi thường gặp, bài tập theo trình độ
19. **get_flashcard_review**: Lấy flashcard cần ôn tập hôm nay (SRS - Spaced Repetition System)
20. **update_flashcard_progress**: Cập nhật tiến độ học flashcard sau khi trả lời (0-5 điểm)
21. **get_vocab_stats**: Thống kê học từ vựng - số từ đã học, cần ôn, mastered
22. **get_new_vocab_cards**: Lấy từ vựng mới để học
23. **get_vocab_list_summary**: Tổng quan các bộ từ vựng của học sinh
24. **get_upcoming_deadlines**: Xem deadline bài tập sắp tới - theo độ ưu tiên, thời gian còn lại

**CÔNG CỤ BÁO CÁO ĐIỂM DANH (Attendance Report Tools - Admin/Teacher):**
25. **classroom_attendance_report**: Báo cáo điểm danh chi tiết cho một lớp học - tỷ lệ đi học, thống kê theo trạng thái, xếp hạng học sinh
26. **student_attendance_history**: Lịch sử điểm danh của một học sinh cụ thể - theo lớp, theo thời gian
27. **attendance_trends**: Phân tích xu hướng điểm danh toàn hệ thống - theo lớp/khóa học/giáo viên/ngày
28. **low_attendance_alerts**: Cảnh báo học sinh có tỷ lệ đi học thấp hoặc vắng nhiều liên tiếp

**CÔNG CỤ TIẾN ĐỘ LUYỆN NÓI (Speaking Progress Tools - Student):**
29. **speaking_overview**: Tổng quan luyện nói AI - số phiên, điểm TB, xu hướng, biểu đồ tiến trinh
30. **speaking_session_detail**: Chi tiết một phiên luyện nói cụ thể - từng turn, feedback phát âm
31. **speaking_trends**: Phân tích xu hướng tiến bộ - so sánh tuần/tháng, điểm cải thiện
32. **pronunciation_analysis**: Phân tích chi tiết phát âm - điểm mạnh/yếu, từ hay sai, gợi ý luyện tập

**CÔNG CỤ THEO DÕI THANH TOÁN (Payment Tracker Tools - Admin/Parent):**
33. **payment_history**: Lịch sử giao dịch thanh toán - filter theo status, ngày, khóa học
34. **revenue_report**: Báo cáo doanh thu chi tiết - theo ngày/tuần/tháng, theo khóa học, biểu đồ xu hướng
35. **pending_payments**: Danh sách giao dịch đang chờ xử lý hoặc cần chú ý
36. **student_payment_status**: Tình trạng thanh toán của học sinh - khóa học đã mua, giao dịch pending

**QUY TẮC SỬ DỤNG:**

🔍 **Khi người dùng hỏi về nội dung/kiến thức:**
   → Dùng knowledge_search để tìm thông tin về khóa học, bài học, từ vựng, hoạt động
   → Ví dụ: "Khóa học IELTS có gì?", "Bài học về thì hiện tại", "Từ vựng chủ đề du lịch"

**Khi người dùng hỏi về dữ liệu/thống kê:**
   → Dùng database_query để lấy dữ liệu từ DB
   → Ví dụ: "10 học viên điểm cao nhất", "Số lượng học viên mới", "Thống kê điểm danh"
   → **HỖ TRỢ ĐẦY ĐỦ:**
     • Truy vấn theo thời gian: NOW(), INTERVAL '2 months', DATE_TRUNC('week', ...)
     • Group by time: GROUP BY DATE_TRUNC('day/week/month/year', "createdAt")
     • Aggregate: COUNT, SUM, AVG, MIN, MAX
     • Window functions, CTEs (WITH), subqueries đều OK
     • Lọc theo khoảng thời gian bất kỳ: ngày, tuần, tháng, năm
   → **VÍ DỤ:** "4 tuần gần nhất" = WHERE "createdAt" >= NOW() - INTERVAL '4 weeks'

**Khi người dùng yêu cầu phân tích chi tiết:**
   → "phân tích học sinh X" → analyze_student (tự động tạo nhiều biểu đồ)
   → "phân tích giáo viên Y" → analyze_teacher (tự động tạo nhiều biểu đồ)
   → "phân tích khóa học Z" → analyze_course (tự động tạo nhiều biểu đồ)
   → "phân tích lớp học W" → analyze_classroom (tự động tạo nhiều biểu đồ)
   → "báo cáo doanh thu" → analyze_revenue (tự động tạo nhiều biểu đồ)
   → "tổng quan hệ thống / dashboard" → system_overview (tự động tạo nhiều biểu đồ)
   → "phân tích bài tập / assignment" → analyze_assignment (tự động tạo nhiều biểu đồ)
   → "tiến độ học tập của tôi / progress" → track_progress (tự động tạo nhiều biểu đồ, dành cho student)

📚 **Khi học sinh hỏi về từ vựng/ngữ pháp:**
   → "từ 'abandon' nghĩa là gì" → lookup_vocabulary (tra cứu + ví dụ + bài tập)
   → "giải thích thì hiện tại hoàn thành" → explain_grammar (quy tắc + lỗi hay gặp + bài tập)
   → Tự động tạo bài tập thực hành nếu học sinh yêu cầu

🎴 **Khi học sinh muốn ôn tập flashcard:**
   → "ôn tập từ vựng hôm nay" → get_flashcard_review (lấy card cần ôn theo SRS)
   → "học từ mới" → get_new_vocab_cards (lấy từ chưa học)
   → "thống kê học từ vựng" → get_vocab_stats (số từ đã học, cần ôn)
   → Sau khi học sinh trả lời, dùng update_flashcard_progress để cập nhật tiến độ (0=quên hoàn toàn, 5=nhớ rõ)

📅 **Khi học sinh hỏi về deadline:**
   → "deadline gần nhất" / "bài tập sắp đến hạn" → get_upcoming_deadlines
   → Hiển thị theo độ ưu tiên: quá hạn (đỏ), gấp (cam), sắp tới (vàng), còn thời gian (xanh)

📊 **Khi người dùng hỏi về điểm danh (Admin/Teacher):**
   → "báo cáo điểm danh lớp X" → classroom_attendance_report (thống kê chi tiết + biểu đồ)
   → "tình hình đi học của học sinh Y" → student_attendance_history
   → "xu hướng điểm danh tháng này" → attendance_trends (phân tích theo thời gian/lớp/khóa)
   → "học sinh nào nghỉ nhiều" / "cảnh báo điểm danh" → low_attendance_alerts

🎤 **Khi học sinh hỏi về luyện nói (Speaking):**
   → "tiến độ luyện nói của tôi" → speaking_overview (tổng quan + biểu đồ)
   → "phiên luyện nói gần nhất" → speaking_session_detail (chi tiết từng turn)
   → "tôi tiến bộ thế nào trong speaking" → speaking_trends (so sánh tuần/tháng)
   → "phát âm của tôi thế nào" → pronunciation_analysis (điểm mạnh/yếu + từ hay sai)

💰 **Khi người dùng hỏi về thanh toán (Admin/Parent):**
   → "lịch sử thanh toán" / "giao dịch gần đây" → payment_history
   → "doanh thu tháng này" / "báo cáo tài chính" → revenue_report (thống kê + biểu đồ)
   → "giao dịch đang chờ" / "thanh toán chưa hoàn tất" → pending_payments
   → "tôi đã đóng học phí chưa" / "tình trạng thanh toán của con" → student_payment_status

🔔 **Khi người dùng muốn gửi thông báo:**
   → Dùng send_notification với targetType phù hợp
   → Ví dụ: "gửi thông báo cho tất cả học viên", "thông báo cho lớp IELTS 1"

**Khi người dùng yêu cầu biểu đồ:**
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

      this.logger.log('LangChain Agent sẵn sàng');
    } catch (e) {
      this.logger.error('Lỗi init Agent:', e as any);
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
                    `Found ${value.intermediateSteps.length} intermediate steps in final output!`,
                  );
                  finalIntermediateSteps = value.intermediateSteps;
                }

                if (output && typeof output === 'string') {
                  this.logger.debug(
                    `Final output: "${output.substring(0, 100)}..."`,
                  );
                  this.logger.debug(
                    `Has streamed tokens: ${hasStreamedTokens}`,
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
                        'Manual tokenization (no streaming tokens received)',
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
                      'Skipping manual tokenization (already streamed)',
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
                      `Parsed chart result: ${JSON.stringify(chartResult).substring(0, 300)}`,
                    );

                    if (chartResult.success && chartResult.chart) {
                      this.logger.log('Chart detected, sending chart chunk');
                      yield {
                        type: 'chart',
                        chart: chartResult.chart,
                      };
                    }
                  } catch (e) {
                    this.logger.warn('Failed to parse chart result:', e);
                  }
                }

                // Check if this is analytics tool result (multiple charts)
                const analyticsTools = [
                  'analyze_student',
                  'analyze_teacher',
                  'analyze_course',
                  'analyze_classroom',
                  'analyze_revenue',
                  'system_overview',
                  'analyze_assignment',
                  'track_progress',
                  'classroom_attendance_report',
                  'attendance_trends',
                  'speaking_overview',
                  'speaking_trends',
                  'pronunciation_analysis',
                  'revenue_report',
                ];
                if (
                  analyticsTools.includes(logValue.name) &&
                  logValue.type === 'tool_end'
                ) {
                  try {
                    const analyticsResult = JSON.parse(logValue.output || '{}');
                    this.logger.debug(
                      `Parsed analytics result: ${JSON.stringify(analyticsResult).substring(0, 500)}`,
                    );

                    // Send multiple charts from analytics tools
                    if (analyticsResult.success && analyticsResult.charts && Array.isArray(analyticsResult.charts)) {
                      this.logger.log(`Analytics detected with ${analyticsResult.charts.length} charts`);
                      for (const chart of analyticsResult.charts) {
                        yield {
                          type: 'chart',
                          chart: chart,
                        };
                      }
                    }
                  } catch (e) {
                    this.logger.warn('Failed to parse analytics result:', e);
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
                        'Excel file detected, sending file chunk',
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
                    this.logger.warn('Failed to parse file result:', e);
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
                    this.logger.log('Chart found in action result!');
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
        `Streaming complete. Total length: ${fullAnswer.length}`,
      );
      this.logger.log(`Full answer content: "${fullAnswer}"`);

      // Use finalIntermediateSteps if steps is empty
      if (steps.length === 0 && finalIntermediateSteps.length > 0) {
        this.logger.log(
          `Using finalIntermediateSteps: ${finalIntermediateSteps.length} steps`,
        );
        steps = finalIntermediateSteps;
      }

      this.logger.log(`🔍 Total steps: ${steps.length}`);

      // Check for chart in intermediate steps (fallback if not detected during streaming)
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        this.logger.log(
          `Step ${i}: tool=${step.action?.tool}, has observation=${!!step.observation}`,
        );

        if (step.action?.tool === 'chart_generator') {
          this.logger.log(`Found chart_generator step!`);
          this.logger.log(
            `Observation: ${JSON.stringify(step.observation).substring(0, 500)}`,
          );

          if (step.observation) {
            try {
              const chartResult =
                typeof step.observation === 'string'
                  ? JSON.parse(step.observation)
                  : step.observation;

              this.logger.log(
                `Parsed result:`,
                JSON.stringify(chartResult).substring(0, 300),
              );

              if (chartResult.success && chartResult.chart) {
                this.logger.log('Sending chart chunk NOW!');
                yield {
                  type: 'chart',
                  chart: chartResult.chart,
                };
              } else {
                this.logger.warn('Chart result missing success/chart field');
              }
            } catch (e) {
              this.logger.error('Failed to parse chart from step:', e);
            }
          }
        }

        // Detect analytics tools with multiple charts
        const analyticsToolsList = [
          'analyze_student',
          'analyze_teacher',
          'analyze_course',
          'analyze_classroom',
          'analyze_revenue',
          'system_overview',
          'analyze_assignment',
          'track_progress',
          'classroom_attendance_report',
          'attendance_trends',
          'speaking_overview',
          'speaking_trends',
          'pronunciation_analysis',
          'revenue_report',
        ];
        const isAnalyticsTool = analyticsToolsList.includes(step.action?.tool);

        if (isAnalyticsTool) {
          this.logger.log(`Found ${step.action?.tool} step!`);
          this.logger.log(
            `Observation: ${JSON.stringify(step.observation).substring(0, 500)}`,
          );

          if (step.observation) {
            try {
              const analyticsResult =
                typeof step.observation === 'string'
                  ? JSON.parse(step.observation)
                  : step.observation;

              this.logger.log(
                `Parsed analytics result:`,
                JSON.stringify(analyticsResult).substring(0, 300),
              );

              // Send multiple charts from analytics tools
              if (analyticsResult.success && analyticsResult.charts && Array.isArray(analyticsResult.charts)) {
                this.logger.log(`Sending ${analyticsResult.charts.length} charts from ${step.action?.tool}!`);
                for (const chart of analyticsResult.charts) {
                  yield {
                    type: 'chart',
                    chart: chart,
                  };
                }
              }
            } catch (e) {
              this.logger.error('Failed to parse analytics from step:', e);
            }
          }
        }

        // Detect all file export tools (Excel, PDF, Word)
        const isFileExportTool = [
          'excel_export',
          'pdf_export',
          'word_export',
        ].includes(step.action?.tool);

        if (isFileExportTool) {
          this.logger.log(`Found ${step.action?.tool} step!`);
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
                `Parsed file result:`,
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
                  'File result missing success/downloadUrl field',
                );
              }
            } catch (e) {
              this.logger.error('Failed to parse file from step:', e);
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
      this.logger.error('Streaming error:', error);
      yield {
        type: 'error',
        content: error.message || 'Unknown error occurred',
      };
    }
  }
}
