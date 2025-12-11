import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class TeacherAnalyticsTool {
  private readonly logger = new Logger(TeacherAnalyticsTool.name);

  constructor(
    private prisma: PrismaRepository,
    private gemini: GeminiService,
  ) {}

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'analyze_teacher',
      description: `Phan tich hieu suat giang day cua giao vien voi AI va tao nhieu bieu do truc quan.

Su dung tool nay khi:
- Nguoi dung hoi "phan tich giao vien X"
- Nguoi dung hoi "hieu suat giang day cua giao vien email abc@gmail.com"
- Nguoi dung hoi "diem trung binh cac lop cua giao vien ten Tran Thi B"
- Nguoi dung muon xem thong ke lop hoc, hoc vien cua giao vien

Ket qua tra ve:
- Thong tin giao vien (ten, email)
- Metrics: so lop, so hoc vien, diem TB cac lop, ty le hoan thanh
- Class performance: hieu suat tung lop hoc
- AI Insights: phan tich hieu qua giang day
- Recommendations: goi y cai thien
- 3-4 bieu do: bar (diem lop), pie (phan bo hoc vien), bar (completion), radar (tong quan)`,
      schema: z.object({
        teacherId: z.string().optional().describe('UUID cua giao vien'),
        teacherName: z
          .string()
          .optional()
          .describe('Ten giao vien de tim kiem'),
        teacherEmail: z
          .string()
          .optional()
          .describe('Email giao vien de tim kiem'),
        period: z
          .enum(['week', 'month', 'quarter', 'all'])
          .optional()
          .default('month')
          .describe('Khoang thoi gian phan tich'),
        includeCharts: z
          .boolean()
          .optional()
          .default(true)
          .describe('Co tao bieu do khong'),
      }),
      func: async ({
        teacherId,
        teacherName,
        teacherEmail,
        period = 'month',
        includeCharts = true,
      }) => {
        return this._call(
          JSON.stringify({
            teacherId,
            teacherName,
            teacherEmail,
            period,
            includeCharts,
          }),
        );
      },
    });
  }

  private async _call(input: string): Promise<string> {
    try {
      this.logger.log(`👨‍🏫 Teacher Analytics input: ${input}`);

      const parsedInput = JSON.parse(input);
      let {
        teacherId,
        teacherName,
        teacherEmail,
        period = 'month',
        includeCharts = true,
      } = parsedInput;

      // 1. Find teacher if only name/email provided
      if (!teacherId && (teacherName || teacherEmail)) {
        const whereClause: any = { role: 'teacher' };

        if (teacherEmail) {
          whereClause.email = {
            contains: teacherEmail,
            mode: 'insensitive',
          };
        } else if (teacherName) {
          whereClause.OR = [
            { displayName: { contains: teacherName, mode: 'insensitive' } },
            { firstName: { contains: teacherName, mode: 'insensitive' } },
            { lastName: { contains: teacherName, mode: 'insensitive' } },
          ];
        }

        const teacher = await this.prisma.user.findFirst({
          where: whereClause,
        });

        if (!teacher) {
          return JSON.stringify({
            success: false,
            error: `Không tìm thấy giáo viên với thông tin: ${teacherName || teacherEmail}`,
          });
        }

        teacherId = teacher.id;
      }

      if (!teacherId) {
        return JSON.stringify({
          success: false,
          error: 'Vui lòng cung cấp teacherId, teacherName hoặc teacherEmail',
        });
      }

      // 2. Query teacher data
      const teacherData = await this.getTeacherData(teacherId, period);

      if (!teacherData.teacher) {
        return JSON.stringify({
          success: false,
          error: 'Không tìm thấy giáo viên',
        });
      }

      // 3. Send to Gemini for AI analysis
      const aiAnalysis = await this.analyzeTeacherWithAI(teacherData);

      // 4. Generate multiple charts if requested
      let charts: any[] = [];
      if (includeCharts) {
        charts = this.generateTeacherCharts(teacherData);
      }

      // 5. Return comprehensive analysis
      return JSON.stringify({
        success: true,
        teacher: {
          id: teacherData.teacher.id,
          name:
            teacherData.teacher.displayName ||
            `${teacherData.teacher.firstName || ''} ${teacherData.teacher.lastName || ''}`.trim(),
          email: teacherData.teacher.email,
        },
        metrics: {
          totalClasses: teacherData.totalClasses,
          activeClasses: teacherData.activeClasses,
          totalStudents: teacherData.totalStudents,
          averageClassSize: teacherData.averageClassSize,
          averageClassScore: teacherData.averageClassScore,
          studentCompletionRate: teacherData.studentCompletionRate,
          totalSessionsConducted: teacherData.totalSessionsConducted,
          upcomingSessions: teacherData.upcomingSessions,
        },
        classPerformance: teacherData.classPerformance,
        aiInsights: aiAnalysis.insights,
        recommendations: aiAnalysis.recommendations,
        summary: aiAnalysis.summary,
        charts, // Array of 3-4 charts
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Teacher analytics error: ${error.message}`,
        error.stack,
      );
      return JSON.stringify({
        success: false,
        error: `Lỗi phân tích giáo viên: ${error.message}`,
      });
    }
  }

  /**
   * Get comprehensive teacher data from database
   */
  private async getTeacherData(teacherId: string, period: string) {
    const startDate = this.getStartDate(period);
    const now = new Date();

    const [teacher, classrooms, sessions] = await Promise.all([
      // Basic teacher info
      this.prisma.user.findUnique({
        where: { id: teacherId },
        select: {
          id: true,
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      }),

      // Classrooms taught
      this.prisma.classroom.findMany({
        where: {
          teacherId,
        },
        include: {
          course: {
            select: {
              title: true,
            },
          },
          students: {
            where: { isActive: true },
            select: {
              studentId: true,
            },
          },
        },
      }),

      // Sessions conducted
      this.prisma.classroomSession.findMany({
        where: {
          instructorId: teacherId,
          startTime: { gte: startDate },
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
          classroomId: true,
        },
      }),
    ]);

    const activeClasses = classrooms.filter(
      (c) => c.status === 'ongoing',
    ).length;
    const totalStudents = classrooms.reduce(
      (sum, c) => sum + c.students.length,
      0,
    );
    const averageClassSize =
      classrooms.length > 0 ? totalStudents / classrooms.length : 0;

    // Get student scores for each class
    const classPerformance = await Promise.all(
      classrooms.map(async (classroom) => {
        const studentIds = classroom.students.map((s) => s.studentId);

        const submissions = await this.prisma.assignmentSubmission.findMany({
          where: {
            studentId: { in: studentIds },
            submittedAt: { gte: startDate },
            score: { not: null },
          },
          include: {
            assignment: {
              select: {
                totalPoints: true,
              },
            },
          },
        });

        const totalScore = submissions.reduce((sum, s) => {
          const percentage = (s.score / s.assignment.totalPoints) * 100;
          return sum + percentage;
        }, 0);

        const avgScore =
          submissions.length > 0 ? totalScore / submissions.length : 0;

        const completedCount = submissions.filter(
          (s) => s.score !== null,
        ).length;
        const totalCount = submissions.length;
        const completionRate =
          totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

        return {
          classroomId: classroom.id,
          classroomName: classroom.name,
          courseName: classroom.course?.title,
          studentCount: classroom.students.length,
          averageScore: Math.round(avgScore * 10) / 10,
          completionRate: Math.round(completionRate * 10) / 10,
        };
      }),
    );

    const totalScores = classPerformance.reduce(
      (sum, c) => sum + c.averageScore,
      0,
    );
    const averageClassScore =
      classPerformance.length > 0 ? totalScores / classPerformance.length : 0;

    const totalCompletionRates = classPerformance.reduce(
      (sum, c) => sum + c.completionRate,
      0,
    );
    const studentCompletionRate =
      classPerformance.length > 0
        ? totalCompletionRates / classPerformance.length
        : 0;

    const completedSessions = sessions.filter(
      (s) => s.status === 'completed',
    ).length;
    const upcomingSessions = sessions.filter(
      (s) => s.status === 'scheduled' && s.startTime > now,
    ).length;

    return {
      teacher,
      totalClasses: classrooms.length,
      activeClasses,
      totalStudents,
      averageClassSize: Math.round(averageClassSize * 10) / 10,
      averageClassScore: Math.round(averageClassScore * 10) / 10,
      studentCompletionRate: Math.round(studentCompletionRate * 10) / 10,
      totalSessionsConducted: completedSessions,
      upcomingSessions,
      classPerformance,
      sessions,
      classrooms,
    };
  }

  /**
   * Analyze teacher data with Gemini AI
   */
  private async analyzeTeacherWithAI(data: any) {
    const prompt = `Bạn là chuyên gia phân tích giáo dục. Phân tích giáo viên với dữ liệu sau:

**Thông tin giáo viên:**
- Tên: ${data.teacher.displayName || data.teacher.firstName + ' ' + data.teacher.lastName}
- Email: ${data.teacher.email}

**Chỉ số giảng dạy:**
- Tổng số lớp: ${data.totalClasses}
- Lớp đang hoạt động: ${data.activeClasses}
- Tổng số học viên: ${data.totalStudents}
- Số học viên trung bình/lớp: ${data.averageClassSize}
- Điểm trung bình các lớp: ${data.averageClassScore}%
- Tỷ lệ hoàn thành bài tập: ${data.studentCompletionRate}%
- Buổi học đã dạy: ${data.totalSessionsConducted}
- Buổi học sắp tới: ${data.upcomingSessions}

**Hiệu suất từng lớp:**
${data.classPerformance
  .map(
    (c) =>
      `- ${c.classroomName}: ${c.studentCount} học viên, điểm TB ${c.averageScore}%, hoàn thành ${c.completionRate}%`,
  )
  .join('\n')}

Hãy đưa ra phân tích chuyên sâu với:
1. **Insights** (3-5 điểm): Phân tích hiệu quả giảng dạy, điểm mạnh, điểm cần cải thiện
2. **Recommendations** (3-4 điểm): Gợi ý cụ thể để nâng cao chất lượng giảng dạy
3. **Summary** (2-3 câu): Tóm tắt tổng quan về giáo viên

Format JSON:
{
  "insights": [
    {
      "category": "Điểm mạnh" | "Điểm yếu" | "Xu hướng" | "Cảnh báo",
      "insight": "Mô tả chi tiết...",
      "sentiment": "positive" | "neutral" | "negative"
    }
  ],
  "recommendations": [
    {
      "title": "Tiêu đề ngắn gọn",
      "description": "Mô tả chi tiết hành động cần làm",
      "priority": "high" | "medium" | "low"
    }
  ],
  "summary": "Tóm tắt tổng quan về giáo viên..."
}

Trả lời bằng tiếng Việt, chuyên nghiệp và dễ hiểu.`;

    try {
      const response = await this.gemini.generateResponse(prompt);
      const cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(cleaned);
    } catch (error) {
      this.logger.error('Failed to parse Gemini response', error);
      return {
        insights: [
          {
            category: 'Tổng quan',
            insight: `Giáo viên đang giảng dạy ${data.totalClasses} lớp với ${data.totalStudents} học viên`,
            sentiment: 'neutral',
          },
        ],
        recommendations: [
          {
            title: 'Tiếp tục giảng dạy',
            description: 'Duy trì phương pháp giảng dạy hiện tại',
            priority: 'medium',
          },
        ],
        summary: `Giáo viên đang có hiệu suất giảng dạy ${data.averageClassScore >= 70 ? 'tốt' : 'cần cải thiện'}.`,
      };
    }
  }

  /**
   * Generate multiple charts for teacher analytics
   */
  private generateTeacherCharts(data: any): any[] {
    const charts: any[] = [];

    // Chart 1: Class performance comparison (Bar chart)
    if (data.classPerformance.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'bar',
        title: 'So sánh điểm trung bình các lớp',
        data: data.classPerformance.map((c) => ({
          name: c.classroomName.substring(0, 15),
          value: c.averageScore,
        })),
        config: {
          xLabel: 'Lớp học',
          yLabel: 'Điểm TB (%)',
          colors: ['#3b82f6'],
          legend: false,
          responsive: true,
        },
      });
    }

    // Chart 2: Student distribution (Pie chart)
    if (data.classPerformance.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'pie',
        title: 'Phân bố học viên theo lớp',
        data: data.classPerformance.map((c) => ({
          name: c.classroomName.substring(0, 20),
          value: c.studentCount,
        })),
        config: {
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
          legend: true,
          responsive: true,
        },
      });
    }

    // Chart 3: Completion rate by class (Bar chart)
    if (data.classPerformance.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'bar',
        title: 'Tỷ lệ hoàn thành bài tập theo lớp',
        data: data.classPerformance.map((c) => ({
          name: c.classroomName.substring(0, 15),
          value: c.completionRate,
        })),
        config: {
          xLabel: 'Lớp học',
          yLabel: 'Tỷ lệ (%)',
          colors: ['#10b981'],
          legend: false,
          responsive: true,
        },
      });
    }

    // Chart 4: Class overview (Radar chart) - only if 6 or fewer classes
    if (data.classPerformance.length > 0 && data.classPerformance.length <= 6) {
      charts.push({
        type: 'chart',
        chartType: 'radar',
        title: 'Tổng quan hiệu suất các lớp',
        data: data.classPerformance.map((c) => ({
          name: c.classroomName.substring(0, 15),
          value: (c.averageScore + c.completionRate) / 2,
        })),
        config: {
          colors: ['#8b5cf6'],
          legend: true,
          responsive: true,
        },
      });
    }

    return charts;
  }

  // ==================== UTILITY METHODS ====================

  private getStartDate(period: string): Date {
    const now = new Date();
    const start = new Date(now);

    switch (period) {
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'all':
        start.setFullYear(2020);
        break;
      default:
        start.setMonth(start.getMonth() - 1);
    }

    return start;
  }
}
