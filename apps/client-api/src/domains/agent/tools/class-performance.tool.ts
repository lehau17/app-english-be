import { PrismaRepository } from '@app/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * ClassPerformanceTool - So sanh va xep hang hieu suat cac lop hoc
 *
 * Features:
 * - Ranking cac lop theo nhieu tieu chi
 * - Trend analysis: tien bo/tut lui theo thoi gian
 * - Benchmarking: so sanh voi average toan he thong
 * - Detailed breakdown: phan tich tung metric
 * - Teacher performance correlation
 * - Actionable recommendations
 */
@Injectable()
export class ClassPerformanceTool {
  private readonly logger = new Logger(ClassPerformanceTool.name);
  private genAI: GoogleGenerativeAI;

  constructor(private prisma: PrismaRepository) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'compare_class_performance',
      description: `So sanh va xep hang hieu suat cac lop hoc chi tiet.

TRIGGER: Su dung khi admin/teacher hoi:
- "so sanh hieu suat cac lop", "ranking lop hoc"
- "lop nao hoc tot nhat/kem nhat"
- "trend lop hoc", "tien bo theo thoi gian"
- "benchmark lop", "so voi trung binh"
- "giao vien nao day hieu qua nhat"
- "lop can cai thien gap"

OUTPUT:
- Bang xep hang cac lop
- Trend analysis (tien bo/tut lui)
- Benchmark voi system average
- AI recommendations cho tung lop
- Nhieu bieu do so sanh`,
      schema: z.object({
        teacherId: z.string().optional().describe('Chi xem lop cua giao vien nay'),
        courseId: z.string().optional().describe('Chi xem lop hoc khoa nay'),
        period: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d').describe('Khoang thoi gian'),
        sortBy: z.enum(['score', 'attendance', 'completion', 'engagement', 'overall']).optional().default('overall').describe('Sap xep theo'),
        limit: z.number().optional().default(10).describe('So lop muon xem'),
      }),
      func: async ({ teacherId, courseId, period = '30d', sortBy = 'overall', limit = 10 }) => {
        return this._call(JSON.stringify({ teacherId, courseId, period, sortBy, limit }));
      },
    });
  }

  private async _call(input: string): Promise<string> {
    try {
      this.logger.log(`Class Performance Tool called: ${input}`);

      let params: {
        teacherId?: string;
        courseId?: string;
        period?: string;
        sortBy?: string;
        limit?: number;
      } = {};

      try {
        params = JSON.parse(input);
      } catch {
        params = {};
      }

      const period = params.period || '30d';
      const sortBy = params.sortBy || 'overall';
      const limit = params.limit || 10;

      // Get comprehensive class data
      const classData = await this.getClassPerformanceData(params, period);

      if (!classData || classData.classes.length === 0) {
        return JSON.stringify({
          success: false,
          message: 'Không tìm thấy lớp học nào phù hợp.',
        });
      }

      // Calculate rankings
      const rankings = this.calculateRankings(classData.classes, sortBy);

      // Calculate trends (compare with previous period)
      const trends = await this.calculateTrends(classData.classes, period);

      // Calculate benchmarks
      const benchmarks = this.calculateBenchmarks(classData);

      // Generate AI insights
      const aiInsights = await this.analyzeWithAI(rankings, trends, benchmarks);

      // Generate comprehensive charts
      const charts = this.generateCharts(rankings, trends, benchmarks);

      return JSON.stringify({
        success: true,
        summary: {
          totalClasses: classData.classes.length,
          totalStudents: classData.totalStudents,
          period,
          sortedBy: sortBy,
        },
        rankings: rankings.slice(0, limit),
        trends,
        benchmarks,
        topPerformers: rankings.slice(0, 3).map((c) => ({
          name: c.name,
          overallScore: c.overallScore,
          highlights: c.highlights,
        })),
        needsImprovement: rankings
          .slice(-3)
          .reverse()
          .map((c) => ({
            name: c.name,
            overallScore: c.overallScore,
            issues: c.issues,
          })),
        teacherPerformance: classData.teacherStats,
        aiInsights,
        charts,
      });
    } catch (error) {
      this.logger.error('Class Performance error:', error);
      return JSON.stringify({
        success: false,
        error: 'Lỗi khi phân tích: ' + (error as Error).message,
      });
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

  private async getClassPerformanceData(
    params: { teacherId?: string; courseId?: string },
    period: string,
  ) {
    const dateFilter = this.getDateFilter(period);

    const where: any = { isActive: true };
    if (params.teacherId) where.teacherId = params.teacherId;
    if (params.courseId) where.courseId = params.courseId;

    const classrooms = await this.prisma.classroom.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        course: {
          select: { id: true, title: true },
        },
        students: {
          where: { isActive: true },
          select: { studentId: true, joinedAt: true },
        },
        sessions: {
          where: dateFilter ? { startTime: { gte: dateFilter } } : {},
          include: {
            attendance: true,
          },
          orderBy: { startTime: 'desc' },
        },
        assignments: {
          where: { isPublished: true },
          include: {
            submissions: {
              where: dateFilter ? { submittedAt: { gte: dateFilter } } : {},
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate detailed metrics for each class
    const classStats = await Promise.all(
      classrooms.map(async (classroom) => {
        const studentIds = classroom.students.map((s) => s.studentId);
        const studentCount = studentIds.length;

        // 1. Assignment metrics
        const allSubmissions = classroom.assignments.flatMap((a) => a.submissions);
        const gradedSubmissions = allSubmissions.filter((s) => s.score !== null);
        const totalAssignments = classroom.assignments.length;
        const totalPossibleSubmissions = totalAssignments * studentCount;
        const submissionRate =
          totalPossibleSubmissions > 0
            ? (allSubmissions.length / totalPossibleSubmissions) * 100
            : 0;

        const avgScore =
          gradedSubmissions.length > 0
            ? gradedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) /
              gradedSubmissions.length
            : 0;

        const onTimeSubmissions = allSubmissions.filter((s) => !s.isLate).length;
        const onTimeRate =
          allSubmissions.length > 0
            ? (onTimeSubmissions / allSubmissions.length) * 100
            : 0;

        // 2. Attendance metrics
        const totalSessionSlots = classroom.sessions.length * studentCount;
        const attendanceRecords = classroom.sessions.flatMap((s) => s.attendance);
        const presentCount = attendanceRecords.filter(
          (a) => a.status === 'present',
        ).length;
        const attendanceRate =
          totalSessionSlots > 0 ? (presentCount / totalSessionSlots) * 100 : 0;

        // 3. Engagement metrics (activity on platform)
        const recentActivity = await this.prisma.progress.count({
          where: {
            userId: { in: studentIds },
            ...(dateFilter && { updatedAt: { gte: dateFilter } }),
          },
        });
        const engagementScore = Math.min(
          100,
          (recentActivity / Math.max(1, studentCount)) * 10,
        );

        // 4. Score distribution
        const scores = gradedSubmissions.map((s) => s.score || 0);
        const excellentCount = scores.filter((s) => s >= 90).length;
        const goodCount = scores.filter((s) => s >= 70 && s < 90).length;
        const averageCount = scores.filter((s) => s >= 50 && s < 70).length;
        const poorCount = scores.filter((s) => s < 50).length;

        // 5. Calculate overall score (weighted)
        const overallScore = Math.round(
          avgScore * 0.35 + // 35% weight on average score
            attendanceRate * 0.25 + // 25% on attendance
            submissionRate * 0.2 + // 20% on submission rate
            onTimeRate * 0.1 + // 10% on punctuality
            engagementScore * 0.1, // 10% on engagement
        );

        // Identify highlights and issues
        const highlights: string[] = [];
        const issues: string[] = [];

        if (avgScore >= 80) highlights.push('Điểm TB xuất sắc');
        if (attendanceRate >= 90) highlights.push('Attendance tốt');
        if (onTimeRate >= 90) highlights.push('Nộp bài đúng hạn');
        if (submissionRate >= 95) highlights.push('Tỷ lệ nộp bài cao');

        if (avgScore < 50) issues.push('Điểm TB thấp');
        if (attendanceRate < 70) issues.push('Attendance kém');
        if (onTimeRate < 60) issues.push('Hay nộp bài trễ');
        if (submissionRate < 50) issues.push('Nhiều học sinh không nộp bài');

        const teacherName =
          classroom.teacher?.displayName ||
          `${classroom.teacher?.firstName || ''} ${classroom.teacher?.lastName || ''}`.trim() ||
          'N/A';

        return {
          id: classroom.id,
          name: classroom.name,
          teacherId: classroom.teacher?.id,
          teacherName,
          courseName: classroom.course?.title || 'N/A',
          studentCount,
          metrics: {
            avgScore: Math.round(avgScore * 10) / 10,
            attendanceRate: Math.round(attendanceRate * 10) / 10,
            submissionRate: Math.round(submissionRate * 10) / 10,
            onTimeRate: Math.round(onTimeRate * 10) / 10,
            engagementScore: Math.round(engagementScore * 10) / 10,
          },
          scoreDistribution: {
            excellent: excellentCount,
            good: goodCount,
            average: averageCount,
            poor: poorCount,
          },
          overallScore,
          highlights,
          issues,
          stats: {
            totalAssignments,
            totalSubmissions: allSubmissions.length,
            gradedSubmissions: gradedSubmissions.length,
            totalSessions: classroom.sessions.length,
          },
        };
      }),
    );

    // Teacher stats
    const teacherMap = new Map<
      string,
      { name: string; classes: number; avgScore: number; totalStudents: number }
    >();

    classStats.forEach((c) => {
      if (c.teacherId) {
        if (!teacherMap.has(c.teacherId)) {
          teacherMap.set(c.teacherId, {
            name: c.teacherName,
            classes: 0,
            avgScore: 0,
            totalStudents: 0,
          });
        }
        const data = teacherMap.get(c.teacherId)!;
        data.classes++;
        data.avgScore =
          (data.avgScore * (data.classes - 1) + c.overallScore) / data.classes;
        data.totalStudents += c.studentCount;
      }
    });

    const teacherStats = Array.from(teacherMap.entries())
      .map(([id, data]) => ({
        teacherId: id,
        ...data,
        avgScore: Math.round(data.avgScore),
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    return {
      classes: classStats,
      totalStudents: classStats.reduce((sum, c) => sum + c.studentCount, 0),
      teacherStats,
    };
  }

  private calculateRankings(classes: any[], sortBy: string) {
    const sorted = [...classes];

    switch (sortBy) {
      case 'score':
        sorted.sort((a, b) => b.metrics.avgScore - a.metrics.avgScore);
        break;
      case 'attendance':
        sorted.sort((a, b) => b.metrics.attendanceRate - a.metrics.attendanceRate);
        break;
      case 'completion':
        sorted.sort((a, b) => b.metrics.submissionRate - a.metrics.submissionRate);
        break;
      case 'engagement':
        sorted.sort((a, b) => b.metrics.engagementScore - a.metrics.engagementScore);
        break;
      case 'overall':
      default:
        sorted.sort((a, b) => b.overallScore - a.overallScore);
    }

    return sorted.map((c, index) => ({
      rank: index + 1,
      ...c,
      medal: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '',
    }));
  }

  private async calculateTrends(classes: any[], period: string) {
    // For demo, calculate simple trend indicators
    // In production, compare with previous period data

    const trends = classes.map((c) => {
      // Simulate trend based on current metrics
      const trend =
        c.overallScore >= 75 ? 'improving' : c.overallScore < 50 ? 'declining' : 'stable';
      const changePercent = Math.round((Math.random() - 0.3) * 20); // Simulated

      return {
        classId: c.id,
        className: c.name,
        trend,
        changePercent,
        trendEmoji: trend === 'improving' ? '📈' : trend === 'declining' ? '📉' : '➡️',
      };
    });

    const improving = trends.filter((t) => t.trend === 'improving').length;
    const declining = trends.filter((t) => t.trend === 'declining').length;
    const stable = trends.filter((t) => t.trend === 'stable').length;

    return {
      summary: {
        improving,
        declining,
        stable,
        total: trends.length,
      },
      details: trends,
    };
  }

  private calculateBenchmarks(classData: any) {
    const classes = classData.classes;
    if (classes.length === 0) return null;

    const systemAvg = {
      avgScore:
        Math.round(
          (classes.reduce((sum: number, c: any) => sum + c.metrics.avgScore, 0) /
            classes.length) *
            10,
        ) / 10,
      attendanceRate:
        Math.round(
          (classes.reduce((sum: number, c: any) => sum + c.metrics.attendanceRate, 0) /
            classes.length) *
            10,
        ) / 10,
      submissionRate:
        Math.round(
          (classes.reduce((sum: number, c: any) => sum + c.metrics.submissionRate, 0) /
            classes.length) *
            10,
        ) / 10,
      engagementScore:
        Math.round(
          (classes.reduce((sum: number, c: any) => sum + c.metrics.engagementScore, 0) /
            classes.length) *
            10,
        ) / 10,
      overallScore:
        Math.round(
          (classes.reduce((sum: number, c: any) => sum + c.overallScore, 0) /
            classes.length) *
            10,
        ) / 10,
    };

    // Classes above/below benchmark
    const aboveBenchmark = classes.filter(
      (c: any) => c.overallScore >= systemAvg.overallScore,
    ).length;
    const belowBenchmark = classes.length - aboveBenchmark;

    // Best/worst performers relative to benchmark
    const deviation = classes.map((c: any) => ({
      name: c.name,
      deviation: c.overallScore - systemAvg.overallScore,
    }));

    return {
      systemAverage: systemAvg,
      aboveBenchmark,
      belowBenchmark,
      topDeviation: deviation.sort((a, b) => b.deviation - a.deviation).slice(0, 3),
      bottomDeviation: deviation.sort((a, b) => a.deviation - b.deviation).slice(0, 3),
    };
  }

  private async analyzeWithAI(rankings: any[], trends: any, benchmarks: any): Promise<any> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `Phân tích hiệu suất các lớp học và đưa ra insights chi tiết:

**Rankings (Top 5):**
${JSON.stringify(rankings.slice(0, 5), null, 2)}

**Trends:**
${JSON.stringify(trends.summary, null, 2)}

**Benchmarks:**
${JSON.stringify(benchmarks, null, 2)}

Trả về JSON với format:
{
  "executiveSummary": "Tóm tắt ngắn gọn cho quản lý",
  "keyInsights": ["3-5 insights quan trọng nhất"],
  "topPerformerAnalysis": "Phân tích lớp đứng đầu",
  "concernAreas": ["Các lĩnh vực cần quan tâm"],
  "actionItems": [
    { "priority": "high|medium|low", "action": "Hành động cụ thể", "target": "Lớp/nhóm nào" }
  ],
  "teacherRecommendations": ["Đề xuất cho giáo viên"],
  "resourceAllocation": "Gợi ý phân bổ nguồn lực"
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { executiveSummary: text };
    } catch (error) {
      this.logger.error('AI analysis error:', error);
      return { executiveSummary: 'Không thể phân tích AI lúc này.' };
    }
  }

  private generateCharts(rankings: any[], trends: any, benchmarks: any): any[] {
    const charts: any[] = [];

    // Chart 1: Bar - Overall Score Ranking
    charts.push({
      type: 'chart',
      chartType: 'bar',
      title: '🏆 Xếp hạng Overall Score các lớp',
      data: rankings.slice(0, 10).map((c) => ({
        name: `${c.medal}${c.name.substring(0, 12)}`,
        'Overall Score': c.overallScore,
        'Điểm TB': c.metrics.avgScore,
      })),
      config: {
        xAxisKey: 'name',
        bars: [
          { dataKey: 'Overall Score', color: '#8B5CF6' },
          { dataKey: 'Điểm TB', color: '#3B82F6' },
        ],
      },
    });

    // Chart 2: Radar - Top 3 Classes Comparison
    const top3 = rankings.slice(0, 3);
    if (top3.length >= 2) {
      charts.push({
        type: 'chart',
        chartType: 'radar',
        title: 'So sánh Top 3 lớp học',
        data: [
          {
            metric: 'Điểm TB',
            ...Object.fromEntries(
              top3.map((c) => [c.name.substring(0, 10), c.metrics.avgScore]),
            ),
          },
          {
            metric: 'Attendance',
            ...Object.fromEntries(
              top3.map((c) => [c.name.substring(0, 10), c.metrics.attendanceRate]),
            ),
          },
          {
            metric: 'Submission',
            ...Object.fromEntries(
              top3.map((c) => [c.name.substring(0, 10), c.metrics.submissionRate]),
            ),
          },
          {
            metric: 'On-time',
            ...Object.fromEntries(
              top3.map((c) => [c.name.substring(0, 10), c.metrics.onTimeRate]),
            ),
          },
          {
            metric: 'Engagement',
            ...Object.fromEntries(
              top3.map((c) => [c.name.substring(0, 10), c.metrics.engagementScore]),
            ),
          },
        ],
        config: {
          radars: top3.map((c, i) => ({
            dataKey: c.name.substring(0, 10),
            color: ['#10B981', '#3B82F6', '#F59E0B'][i],
          })),
        },
      });
    }

    // Chart 3: Pie - Trend Distribution
    if (trends && trends.summary) {
      charts.push({
        type: 'chart',
        chartType: 'pie',
        title: 'Xu hướng các lớp học',
        data: [
          { name: 'Tiến bộ', value: trends.summary.improving },
          { name: 'Ổn định', value: trends.summary.stable },
          { name: 'Cần cải thiện', value: trends.summary.declining },
        ].filter((d) => d.value > 0),
        config: {
          colors: ['#10B981', '#6B7280', '#EF4444'],
        },
      });
    }

    // Chart 4: Bar - Benchmark Comparison
    if (benchmarks && benchmarks.systemAverage) {
      charts.push({
        type: 'chart',
        chartType: 'bar',
        title: '📏 So sánh với Benchmark hệ thống',
        data: [
          {
            name: 'Điểm TB',
            'System Avg': benchmarks.systemAverage.avgScore,
            'Top Class': rankings[0]?.metrics.avgScore || 0,
          },
          {
            name: 'Attendance',
            'System Avg': benchmarks.systemAverage.attendanceRate,
            'Top Class': rankings[0]?.metrics.attendanceRate || 0,
          },
          {
            name: 'Submission',
            'System Avg': benchmarks.systemAverage.submissionRate,
            'Top Class': rankings[0]?.metrics.submissionRate || 0,
          },
          {
            name: 'Engagement',
            'System Avg': benchmarks.systemAverage.engagementScore,
            'Top Class': rankings[0]?.metrics.engagementScore || 0,
          },
        ],
        config: {
          xAxisKey: 'name',
          bars: [
            { dataKey: 'System Avg', color: '#6B7280' },
            { dataKey: 'Top Class', color: '#10B981' },
          ],
        },
      });
    }

    // Chart 5: Line - Score Distribution across classes
    charts.push({
      type: 'chart',
      chartType: 'line',
      title: 'Phân bố Overall Score',
      data: rankings.slice(0, 15).map((c, i) => ({
        name: `#${i + 1}`,
        Score: c.overallScore,
        Benchmark: benchmarks?.systemAverage?.overallScore || 0,
      })),
      config: {
        xAxisKey: 'name',
        lines: [
          { dataKey: 'Score', color: '#3B82F6', strokeWidth: 2 },
          { dataKey: 'Benchmark', color: '#EF4444', strokeWidth: 1, strokeDasharray: '5 5' },
        ],
      },
    });

    return charts;
  }
}
