import { PrismaRepository } from '@app/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class AssignmentAnalyticsTool {
  private readonly logger = new Logger(AssignmentAnalyticsTool.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly prisma: PrismaRepository) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'analyze_assignment',
      description: `Phan tich thong ke bai tap va ket qua lam bai. Su dung khi nguoi dung hoi ve:
- "phan tich bai tap", "thong ke assignment"
- "ty le nop bai", "diem trung binh bai tap"
- "hoc sinh nao chua nop bai", "bai nao kho nhat"
- "so sanh diem cac bai kiem tra"
- "phan tich homework/quiz/midterm/final"`,
      schema: z.object({
        classroomId: z.string().optional().describe('ID lop hoc'),
        assignmentId: z.string().optional().describe('ID bai tap cu the'),
        period: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d').describe('Khoang thoi gian'),
        teacherId: z.string().optional().describe('ID giao vien'),
      }),
      func: async ({ classroomId, assignmentId, period = '30d', teacherId }) => {
        return this._call(JSON.stringify({ classroomId, assignmentId, period, teacherId }));
      },
    });
  }

  private async _call(input: string): Promise<string> {
    try {
      const params = this.parseInput(input);
      const data = await this.gatherData(params);
      const aiInsights = await this.analyzeWithAI(data);
      const charts = this.generateCharts(data);

      return JSON.stringify({
        success: true,
        data: {
          summary: data.summary,
          insights: aiInsights,
          charts,
          details: {
            byType: data.byType,
            byStatus: data.byStatus,
            topDifficult: data.topDifficult,
            lateSubmissions: data.lateSubmissions,
            notSubmitted: data.notSubmitted,
          },
        },
      });
    } catch (error) {
      this.logger.error('Assignment analytics error:', error);
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }

  private parseInput(input: string): {
    classroomId?: string;
    assignmentId?: string;
    period: string;
    teacherId?: string;
  } {
    try {
      const parsed = JSON.parse(input);
      return {
        classroomId: parsed.classroomId,
        assignmentId: parsed.assignmentId,
        period: parsed.period || '30d',
        teacherId: parsed.teacherId,
      };
    } catch {
      return { period: '30d' };
    }
  }

  private getDateFilter(period: string): Date | null {
    const now = new Date();
    switch (period) {
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      case '90d':
        return new Date(now.setDate(now.getDate() - 90));
      case 'all':
        return null;
      default:
        return new Date(now.setDate(now.getDate() - 30));
    }
  }

  private async gatherData(params: {
    classroomId?: string;
    assignmentId?: string;
    period: string;
    teacherId?: string;
  }) {
    const dateFilter = this.getDateFilter(params.period);

    // Build where clause
    const whereClause: any = {};
    if (params.classroomId) whereClause.classroomId = params.classroomId;
    if (params.assignmentId) whereClause.id = params.assignmentId;
    if (params.teacherId) whereClause.teacherId = params.teacherId;
    if (dateFilter) whereClause.createdAt = { gte: dateFilter };

    // Get assignments with submissions
    const assignments = await this.prisma.assignment.findMany({
      where: whereClause,
      include: {
        submissions: {
          include: {
            student: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
        classroom: {
          include: {
            students: {
              where: { isActive: true },
              include: {
                student: {
                  select: { id: true, displayName: true, email: true },
                },
              },
            },
          },
        },
        assignmentActivities: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary
    const totalAssignments = assignments.length;
    const totalSubmissions = assignments.reduce((sum, a) => sum + a.submissions.length, 0);
    const totalPossibleSubmissions = assignments.reduce(
      (sum, a) => sum + (a.classroom?.students?.length || 0),
      0,
    );
    const submissionRate =
      totalPossibleSubmissions > 0
        ? Math.round((totalSubmissions / totalPossibleSubmissions) * 100)
        : 0;

    // Calculate average scores
    const allScores = assignments.flatMap((a) =>
      a.submissions.filter((s) => s.score !== null).map((s) => s.score as number),
    );
    const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;

    // Group by type
    const byType: Record<string, { count: number; avgScore: number; submissions: number }> = {};
    assignments.forEach((a) => {
      const type = a.type || 'HOMEWORK';
      if (!byType[type]) {
        byType[type] = { count: 0, avgScore: 0, submissions: 0 };
      }
      byType[type].count++;
      byType[type].submissions += a.submissions.length;

      const scores = a.submissions.filter((s) => s.score !== null).map((s) => s.score as number);
      if (scores.length > 0) {
        const currentAvg = byType[type].avgScore;
        const currentCount = byType[type].count - 1;
        const newAvg = scores.reduce((x, y) => x + y, 0) / scores.length;
        byType[type].avgScore = currentCount > 0 ? (currentAvg * currentCount + newAvg) / byType[type].count : newAvg;
      }
    });

    // Group by status
    const byStatus = {
      draft: assignments.filter((a) => a.status === 'draft').length,
      published: assignments.filter((a) => a.status === 'published').length,
      completed: assignments.filter((a) => a.status === 'completed').length,
      overdue: assignments.filter((a) => a.status === 'overdue').length,
    };

    // Find top difficult assignments (lowest avg score)
    const topDifficult = assignments
      .map((a) => {
        const scores = a.submissions.filter((s) => s.score !== null).map((s) => s.score as number);
        const avg = scores.length > 0 ? scores.reduce((x, y) => x + y, 0) / scores.length : null;
        return {
          id: a.id,
          title: a.title,
          type: a.type,
          avgScore: avg !== null ? Math.round(avg) : null,
          submissionCount: a.submissions.length,
          totalStudents: a.classroom?.students?.length || 0,
        };
      })
      .filter((a) => a.avgScore !== null && a.submissionCount >= 3)
      .sort((a, b) => (a.avgScore || 0) - (b.avgScore || 0))
      .slice(0, 5);

    // Late submissions
    const lateSubmissions = assignments.flatMap((a) =>
      a.submissions
        .filter((s) => s.isLate)
        .map((s) => ({
          assignmentTitle: a.title,
          studentName: s.student?.displayName || s.student?.email || 'Unknown',
          submittedAt: s.submittedAt,
          score: s.score,
        })),
    );

    // Not submitted (students who haven't submitted)
    const notSubmitted: Array<{
      assignmentId: string;
      assignmentTitle: string;
      dueDate: Date | null;
      students: Array<{ id: string; name: string }>;
    }> = [];

    assignments.forEach((a) => {
      if (a.isPublished && a.classroom?.students) {
        const submittedStudentIds = new Set(a.submissions.map((s) => s.studentId));
        const missing = a.classroom.students
          .filter((cs) => !submittedStudentIds.has(cs.studentId))
          .map((cs) => ({
            id: cs.studentId,
            name: cs.student?.displayName || cs.student?.email || 'Unknown',
          }));

        if (missing.length > 0) {
          notSubmitted.push({
            assignmentId: a.id,
            assignmentTitle: a.title,
            dueDate: a.dueDate,
            students: missing,
          });
        }
      }
    });

    // Score distribution
    const scoreDistribution = {
      excellent: allScores.filter((s) => s >= 90).length,
      good: allScores.filter((s) => s >= 70 && s < 90).length,
      average: allScores.filter((s) => s >= 50 && s < 70).length,
      poor: allScores.filter((s) => s < 50).length,
    };

    return {
      summary: {
        totalAssignments,
        totalSubmissions,
        totalPossibleSubmissions,
        submissionRate,
        avgScore,
        lateCount: lateSubmissions.length,
        notSubmittedCount: notSubmitted.reduce((sum, a) => sum + a.students.length, 0),
      },
      byType: Object.entries(byType).map(([type, data]) => ({
        type,
        ...data,
        avgScore: Math.round(data.avgScore),
      })),
      byStatus,
      topDifficult,
      lateSubmissions: lateSubmissions.slice(0, 10),
      notSubmitted: notSubmitted.slice(0, 5),
      scoreDistribution,
    };
  }

  private async analyzeWithAI(data: any): Promise<any> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `Phân tích dữ liệu bài tập và đưa ra insights chi tiết:

${JSON.stringify(data, null, 2)}

Trả về JSON với format:
{
  "summary": "Tóm tắt tổng quan tình hình bài tập",
  "submissionAnalysis": "Phân tích tỷ lệ nộp bài",
  "scoreAnalysis": "Phân tích điểm số và xu hướng",
  "concerns": ["Vấn đề cần lưu ý (học sinh chưa nộp, điểm thấp...)"],
  "recommendations": ["Đề xuất cải thiện cho giáo viên"],
  "difficultTopics": ["Các bài/chủ đề học sinh gặp khó khăn"]
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

    // Chart 1: Bar - Submissions by assignment type
    if (data.byType.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'bar',
        title: 'Số bài nộp theo loại bài tập',
        data: data.byType.map((t: any) => ({
          name: this.getTypeName(t.type),
          'Số bài nộp': t.submissions,
          'Số bài tập': t.count,
        })),
        config: {
          xAxisKey: 'name',
          bars: [
            { dataKey: 'Số bài nộp', color: '#3B82F6' },
            { dataKey: 'Số bài tập', color: '#10B981' },
          ],
        },
      });
    }

    // Chart 2: Radar - Average score by type
    if (data.byType.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'radar',
        title: 'Điểm trung bình theo loại bài',
        data: data.byType.map((t: any) => ({
          subject: this.getTypeName(t.type),
          'Điểm TB': t.avgScore,
          fullMark: 100,
        })),
        config: {
          radars: [{ dataKey: 'Điểm TB', color: '#8B5CF6' }],
        },
      });
    }

    // Chart 3: Pie - Score distribution
    if (data.scoreDistribution) {
      const distData = [
        { name: 'Xuất sắc (≥90)', value: data.scoreDistribution.excellent },
        { name: 'Khá (70-89)', value: data.scoreDistribution.good },
        { name: 'Trung bình (50-69)', value: data.scoreDistribution.average },
        { name: 'Yếu (<50)', value: data.scoreDistribution.poor },
      ].filter((d) => d.value > 0);

      if (distData.length > 0) {
        charts.push({
          type: 'chart',
          chartType: 'pie',
          title: 'Phân bố điểm số',
          data: distData,
          config: {
            colors: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
          },
        });
      }
    }

    // Chart 4: Bar - Assignment status
    const statusData = [
      { name: 'Bản nháp', value: data.byStatus.draft },
      { name: 'Đã xuất bản', value: data.byStatus.published },
      { name: 'Hoàn thành', value: data.byStatus.completed },
      { name: 'Quá hạn', value: data.byStatus.overdue },
    ].filter((d) => d.value > 0);

    if (statusData.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'bar',
        title: 'Trạng thái bài tập',
        data: statusData.map((d) => ({ name: d.name, 'Số lượng': d.value })),
        config: {
          xAxisKey: 'name',
          bars: [{ dataKey: 'Số lượng', color: '#6366F1' }],
        },
      });
    }

    return charts;
  }

  private getTypeName(type: string): string {
    const names: Record<string, string> = {
      HOMEWORK: 'Bài tập về nhà',
      QUIZ: 'Kiểm tra ngắn',
      MIDTERM_EXAM: 'Thi giữa kỳ',
      FINAL_EXAM: 'Thi cuối kỳ',
    };
    return names[type] || type;
  }
}
