import { PrismaRepository } from '@app/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class SystemOverviewTool {
  private readonly logger = new Logger(SystemOverviewTool.name);
  private genAI: GoogleGenerativeAI;

  constructor(private prisma: PrismaRepository) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'system_overview',
      description: `Tong quan he thong voi AI insights va tao nhieu bieu do dashboard.

TRIGGER: Su dung khi admin muon:
- "tong quan he thong"
- "dashboard"
- "thong ke toan bo"
- "bao cao tong hop"
- "system status"
- "overview"

OUTPUT: Tra ve:
- Tong so users, courses, classrooms, lessons
- Hoat dong theo ngay/tuan
- Top performers
- 3-4 bieu do truc quan
- AI insights va alerts`,
      schema: z.object({
        period: z
          .enum(['day', 'week', 'month', 'year'])
          .optional()
          .default('month')
          .describe('Khoang thoi gian'),
        includeDetails: z
          .boolean()
          .optional()
          .default(false)
          .describe('Lay chi tiet'),
      }),
      func: async ({ period = 'month', includeDetails = false }) => {
        return this._call(JSON.stringify({ period, includeDetails }));
      },
    });
  }

  private async _call(input: string): Promise<string> {
    try {
      this.logger.log(`System Overview Tool called with: ${input}`);

      let params: { period?: string; includeDetails?: boolean } = {};
      try {
        params = JSON.parse(input);
      } catch {
        params = { period: 'month' };
      }

      // Get system data
      const systemData = await this.getSystemData(params);

      // Generate AI insights
      const aiInsights = await this.analyzeWithAI(systemData);

      // Generate charts
      const charts = this.generateCharts(systemData);

      return JSON.stringify({
        success: true,
        summary: systemData.summary,
        usersByRole: systemData.usersByRole,
        recentActivity: systemData.recentActivity,
        topPerformers: systemData.topPerformers,
        aiInsights,
        charts,
      });
    } catch (error) {
      this.logger.error('System Overview error:', error);
      return JSON.stringify({
        success: false,
        error: 'Lỗi khi lấy tổng quan hệ thống: ' + (error as Error).message,
      });
    }
  }

  private async getSystemData(params: {
    period?: string;
    includeDetails?: boolean;
  }) {
    const now = new Date();
    const periodDays =
      params.period === 'day'
        ? 1
        : params.period === 'week'
          ? 7
          : params.period === 'year'
            ? 365
            : 30;
    const startDate = new Date(
      now.getTime() - periodDays * 24 * 60 * 60 * 1000,
    );

    // Get counts
    const [
      totalUsers,
      totalCourses,
      totalClassrooms,
      totalLessons,
      totalAssignments,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.course.count({ where: { isPublished: true } }),
      this.prisma.classroom.count(),
      this.prisma.lesson.count(),
      this.prisma.assignment.count(),
    ]);

    // Get users by role
    const usersByRole = await this.prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    // Get recent registrations
    const recentUsers = await this.prisma.user.count({
      where: { createdAt: { gte: startDate } },
    });

    // Get recent submissions
    const recentSubmissions = await this.prisma.assignmentSubmission.count({
      where: { submittedAt: { gte: startDate } },
    });

    // Get daily activity (last 14 days for better performance)
    const dailyActivity: {
      date: string;
      registrations: number;
      submissions: number;
    }[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];

      const [registrations, submissions] = await Promise.all([
        this.prisma.user.count({
          where: {
            createdAt: { gte: date, lt: nextDate },
          },
        }),
        this.prisma.assignmentSubmission.count({
          where: {
            submittedAt: { gte: date, lt: nextDate },
          },
        }),
      ]);

      dailyActivity.push({ date: dateStr, registrations, submissions });
    }

    // Get top students (simplified)
    const topStudents = await this.prisma.assignmentSubmission.groupBy({
      by: ['studentId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const topStudentDetails = await Promise.all(
      topStudents.map(async (s) => {
        const user = await this.prisma.user.findUnique({
          where: { id: s.studentId },
          select: {
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        });
        return {
          name:
            user?.displayName ||
            `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
            user?.email ||
            'N/A',
          submissions: s._count.id,
        };
      }),
    );

    return {
      summary: {
        totalUsers,
        totalCourses,
        totalClassrooms,
        totalLessons,
        totalAssignments,
        recentUsers,
        recentSubmissions,
        period: params.period || 'month',
      },
      usersByRole: usersByRole.map((u) => ({
        role: u.role,
        count: u._count.id,
      })),
      recentActivity: dailyActivity,
      topPerformers: {
        students: topStudentDetails,
      },
    };
  }

  private async analyzeWithAI(data: any): Promise<any> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const prompt = `Phân tích dữ liệu hệ thống sau và đưa ra insights:

${JSON.stringify(data, null, 2)}

Trả về JSON với format:
{
  "summary": "Tóm tắt tình hình hệ thống",
  "growthRate": "Tốc độ tăng trưởng người dùng",
  "peakTimes": "Thời điểm hoạt động cao nhất",
  "highlights": ["Điểm nổi bật của hệ thống"],
  "alerts": ["Cảnh báo cần lưu ý (nếu có)"],
  "recommendations": ["Đề xuất cải thiện"]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { summary: text };
    } catch (error) {
      this.logger.error('AI analysis error:', error);
      return { summary: 'Không thể phân tích AI lúc này.' };
    }
  }

  private generateCharts(data: any): any[] {
    const charts: any[] = [];

    // Chart 1: Pie - Users by role
    charts.push({
      type: 'chart',
      chartType: 'pie',
      title: '👥 Phân bố người dùng theo vai trò',
      data: data.usersByRole.map((u: any) => ({
        name: this.getRoleName(u.role),
        value: u.count,
      })),
      config: {
        colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
      },
    });

    // Chart 2: Line - Daily activity (last 14 days)
    charts.push({
      type: 'chart',
      chartType: 'line',
      title: 'Hoạt động 14 ngày gần nhất',
      data: data.recentActivity.map((d: any) => ({
        name: d.date.substring(5), // MM-DD
        'Đăng ký': d.registrations,
        'Bài nộp': d.submissions,
      })),
      config: {
        xAxisKey: 'name',
        lines: [
          { dataKey: 'Đăng ký', color: '#3B82F6', strokeWidth: 2 },
          { dataKey: 'Bài nộp', color: '#10B981', strokeWidth: 2 },
        ],
      },
    });

    // Chart 3: Bar - Top students
    if (data.topPerformers.students.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'bar',
        title: '🏆 Top 5 học viên tích cực nhất',
        data: data.topPerformers.students.map((s: any) => ({
          name: s.name.substring(0, 15),
          'Bài nộp': s.submissions,
        })),
        config: {
          xAxisKey: 'name',
          bars: [{ dataKey: 'Bài nộp', color: '#3B82F6' }],
        },
      });
    }

    // Chart 4: Bar - System summary
    charts.push({
      type: 'chart',
      chartType: 'bar',
      title: 'Tổng quan hệ thống',
      data: [
        { name: 'Users', value: data.summary.totalUsers },
        { name: 'Courses', value: data.summary.totalCourses },
        { name: 'Classrooms', value: data.summary.totalClassrooms },
        { name: 'Lessons', value: data.summary.totalLessons },
        { name: 'Assignments', value: data.summary.totalAssignments },
      ],
      config: {
        xAxisKey: 'name',
        bars: [{ dataKey: 'value', color: '#8B5CF6' }],
      },
    });

    return charts;
  }

  private getRoleName(role: string): string {
    const roleNames: Record<string, string> = {
      student: 'Học viên',
      teacher: 'Giáo viên',
      parent: 'Phụ huynh',
      admin: 'Admin',
      superadmin: 'Super Admin',
    };
    return roleNames[role] || role;
  }
}
