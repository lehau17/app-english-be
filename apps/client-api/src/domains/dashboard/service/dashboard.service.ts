import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import {
  AnalyticsInsight,
  AnalyticsRecommendation,
  AnalyticsPeriod,
  ClassAnalyticsResponse,
  StrugglingStudent,
  StudentAnalyticsResponse,
} from '../dto/analytics.dto';
import { DashboardDto } from '../dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaRepository,
    private readonly geminiService: GeminiService,
  ) { }

  async getDashboardData(): Promise<DashboardDto> {
    const now = new Date();

    const [
      latestSnapshot,
      courseDistributionRaw,
      upcomingSessionsRaw,
      recentNotifications,
    ] = await this.prisma.$transaction([
      this.getLatestSnapshot(),
      this.getCourseDistribution(),
      this.getUpcomingSessions(now),
      this.getRecentNotifications(now),
    ]);

    // Use snapshot if available and recent (within 24 hours), otherwise use real-time
    const snapshotAge = latestSnapshot
      ? now.getTime() - latestSnapshot.createdAt.getTime()
      : Infinity;
    const useSnapshot = latestSnapshot && snapshotAge < 24 * 60 * 60 * 1000;

    let baseSnapshot: DashboardDto;

    if (useSnapshot) {
      baseSnapshot = this.mapSnapshot(latestSnapshot);
    } else {
      // Real-time queries as fallback
      const [realTimeStats, recentStudentsRaw, registrationTrendRaw] =
        await Promise.all([
          this.getRealTimeStats(),
          this.getRecentStudents(),
          this.getRegistrationTrend(),
        ]);

      baseSnapshot = {
        totalStudents: realTimeStats.totalStudents,
        totalCourses: realTimeStats.totalCourses,
        totalLessons: realTimeStats.totalLessons,
        totalActivities: realTimeStats.totalActivities,
        recentStudents: this.mapRecentStudents(recentStudentsRaw),
        registrationTrend: registrationTrendRaw,
        courseDistribution: [], // Will be set below
        upcomingClasses: [], // Will be set below
        notifications: [], // Will be set below
      };
    }

    const courseDistribution = this.mapCourseDistribution(
      courseDistributionRaw,
    );
    const upcomingClasses = this.mapUpcomingSessions(upcomingSessionsRaw);
    const notifications = this.mapNotifications(recentNotifications);

    return {
      ...baseSnapshot,
      courseDistribution,
      upcomingClasses,
      notifications,
    };
  }

  // ---------- Queries ----------

  private getLatestSnapshot() {
    return this.prisma.dashboard.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }

  private getCourseDistribution() {
    return this.prisma.course.groupBy({
      by: ['difficulty'],
      _count: { _all: true },
    });
  }

  private getUpcomingSessions(now: Date) {
    return this.prisma.classroomSession.findMany({
      where: {
        status: { in: ['scheduled', 'ongoing'] },
        OR: [
          { startTime: { gte: now } }, // chưa bắt đầu
          {
            AND: [
              { startTime: { lt: now } }, // đã bắt đầu
              { endTime: { gte: now } }, // nhưng chưa kết thúc
            ],
          },
        ],
      },
      orderBy: { startTime: 'asc' },
      take: 5,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        type: true,
        meetingUrl: true,
        location: true,
        classroom: {
          select: {
            id: true,
            name: true,
            maxStudents: true,
            students: {
              where: { isActive: true },
              select: { studentId: true },
            },
            course: { select: { title: true } },
          },
        },
        instructor: {
          select: { displayName: true, firstName: true, lastName: true },
        },
      },
    });
  }

  private getRecentNotifications(now: Date) {
    return this.prisma.notification.findMany({
      where: {
        AND: [
          { OR: [{ targetRole: 'admin' }, { targetRole: null }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  // Real-time queries (fallback when snapshot is null or old)
  private async getRealTimeStats() {
    const [totalStudents, totalCourses, totalLessons, totalActivities] =
      await Promise.all([
        this.prisma.user.count({ where: { role: 'student' } }),
        this.prisma.course.count(),
        this.prisma.lesson.count(),
        this.prisma.activity.count(),
      ]);

    return {
      totalStudents,
      totalCourses,
      totalLessons,
      totalActivities,
    };
  }

  private getRecentStudents() {
    return this.prisma.user.findMany({
      where: { role: 'student' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  private async getRegistrationTrend() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const registrations = await this.prisma.user.findMany({
      where: {
        role: 'student',
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        createdAt: true,
      },
    });

    // Group by date
    const trendMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      trendMap.set(dateKey, 0);
    }

    registrations.forEach((reg) => {
      const dateKey = reg.createdAt.toISOString().split('T')[0];
      const current = trendMap.get(dateKey) || 0;
      trendMap.set(dateKey, current + 1);
    });

    return Array.from(trendMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }

  // ---------- Mapping ----------

  private mapSnapshot(latestSnapshot: any): DashboardDto {
    const baseSnapshot = DashboardDto.defaultValueResponse();

    if (latestSnapshot) {
      baseSnapshot.totalStudents = latestSnapshot.totalStudents;
      baseSnapshot.totalCourses = latestSnapshot.totalCourses;
      baseSnapshot.totalLessons = latestSnapshot.totalLessons;
      baseSnapshot.totalActivities = latestSnapshot.totalActivities;
      baseSnapshot.recentStudents =
        safeJsonParse<any[]>(latestSnapshot.recentStudents) ?? [];
      baseSnapshot.registrationTrend =
        safeJsonParse<any[]>(latestSnapshot.registrationTrend) ?? [];
    }

    return baseSnapshot;
  }

  private mapCourseDistribution(
    raw: Array<{ difficulty: string; _count: { _all: number } }>,
  ) {
    const courseDifficultyLabel: Record<string, string> = {
      beginner: 'Beginner',
      elementary: 'Elementary',
      intermediate: 'Intermediate',
      upper_intermediate: 'Upper Intermediate',
      advanced: 'Advanced',
    };

    return raw.map((item) => ({
      label: courseDifficultyLabel[item.difficulty] ?? item.difficulty,
      value: item._count._all,
    }));
  }

  private mapUpcomingSessions(raw: any[]) {
    return raw.map((session) => {
      const instructor = session.instructor;
      const teacherName =
        instructor?.displayName ||
        [instructor?.firstName, instructor?.lastName]
          .filter(Boolean)
          .join(' ') ||
        'Chưa xác định';

      const classroom = session.classroom;
      const activeStudents = classroom?.students?.length ?? 0;

      // Determine room name: use location for offline, meetingUrl for online, or null
      const roomName =
        session.type === 'online'
          ? session.meetingUrl
            ? 'Online (Meeting Link)'
            : null
          : session.location || null;

      return {
        id: session.id,
        classroomName: classroom?.name ?? 'Lớp học chưa đặt tên',
        courseTitle: classroom?.course?.title,
        teacherName,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString(),
        roomName,
        activeStudents,
        maxStudents: classroom?.maxStudents ?? null,
      };
    });
  }

  private mapNotifications(raw: any[]) {
    const severityMap: Record<
      NotificationType | string,
      'success' | 'warning' | 'error' | 'info'
    > = {
      achievement: 'success',
      reminder: 'warning',
      assignment: 'warning',
      system: 'info',
      social: 'info',
      parent_child: 'info',
    };

    return raw.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.body,
      type: severityMap[notification.type] ?? 'info',
      createdAt: notification.createdAt.toISOString(),
    }));
  }

  private mapRecentStudents(raw: any[]) {
    return raw.map((student) => ({
      id: student.id,
      email: student.email,
      displayName: student.displayName,
      firstName: student.firstName,
      lastName: student.lastName,
    }));
  }

  // ==================== AI Analytics Methods ====================

  async getStudentAIAnalytics(
    studentId: string,
    period: AnalyticsPeriod = AnalyticsPeriod.LAST_30_DAYS,
  ): Promise<StudentAnalyticsResponse> {
    // 1. Validate student exists
    const student = await this.prisma.user.findUnique({
      where: { id: studentId, role: 'student' },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const studentName =
      student.displayName ||
      [student.firstName, student.lastName].filter(Boolean).join(' ') ||
      'Student';

    // 2. Calculate date range
    const dateRange = this.getDateRange(period);

    // 3. Fetch progress data
    const progressData = await this.prisma.progress.findMany({
      where: {
        userId: studentId,
        updatedAt: { gte: dateRange },
      },
      include: {
        activity: {
          select: {
            type: true,
            title: true,
          },
        },
      },
    });

    // 4. Aggregate statistics
    const totalActivities = progressData.length;
    const completedActivities = progressData.filter(
      (p) => p.state === 'done',
    ).length;
    const totalScore = progressData.reduce((sum, p) => sum + (p.score || 0), 0);
    const totalTimeSpent = progressData.reduce(
      (sum, p) => sum + (p.timeSpentSec || 0),
      0,
    );

    const averageScore =
      totalActivities > 0 ? totalScore / totalActivities : 0;
    const completionRate =
      totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0;

    // 5. Group by activity type
    const activityTypeStats: Record<
      string,
      { count: number; totalScore: number }
    > = {};

    progressData.forEach((p) => {
      const type = p.activity?.type || 'other';
      if (!activityTypeStats[type]) {
        activityTypeStats[type] = { count: 0, totalScore: 0 };
      }
      activityTypeStats[type].count++;
      activityTypeStats[type].totalScore += p.score || 0;
    });

    const activityTypePerformance = Object.entries(activityTypeStats).map(
      ([type, stats]) => ({
        type,
        averageScore: stats.count > 0 ? stats.totalScore / stats.count : 0,
        count: stats.count,
      }),
    );

    // 6. Generate AI insights using Gemini
    const prompt = `Bạn là một chuyên gia phân tích giáo dục. Dựa trên dữ liệu học tập của học viên sau đây, hãy phân tích và đưa ra nhận xét chi tiết.

Thông tin học viên:
- Tên: ${studentName}
- Thời gian phân tích: ${this.getPeriodLabel(period)}
- Tổng số hoạt động: ${totalActivities}
- Hoạt động hoàn thành: ${completedActivities} (${completionRate.toFixed(1)}%)
- Điểm trung bình: ${averageScore.toFixed(1)}/100
- Tổng thời gian học: ${Math.round(totalTimeSpent / 60)} phút

Phân tích theo loại hoạt động:
${activityTypePerformance
        .map(
          (a) =>
            `- ${a.type}: ${a.averageScore.toFixed(1)}/100 (${a.count} hoạt động)`,
        )
        .join('\n')}

Yêu cầu:
1. Xác định 2-3 điểm mạnh của học viên
2. Xác định 2-3 điểm cần cải thiện
3. Đưa ra 3-4 khuyến nghị cụ thể để học viên tiến bộ
4. Viết tóm tắt tổng quan về tiến độ học tập

Trả về kết quả dưới dạng JSON với cấu trúc:
{
  "insights": [
    { "category": "Điểm mạnh", "insight": "...", "sentiment": "positive" },
    { "category": "Điểm yếu", "insight": "...", "sentiment": "negative" }
  ],
  "recommendations": [
    { "title": "...", "description": "...", "priority": "high|medium|low" }
  ],
  "summary": "Tóm tắt tổng quan (2-3 câu)"
}`;

    const aiResponse = await this.geminiService.generateResponse(prompt);
    const aiData = this.parseAIResponse(aiResponse);

    return {
      studentId,
      studentName,
      totalActivitiesCompleted: completedActivities,
      averageScore: parseFloat(averageScore.toFixed(1)),
      completionRate: parseFloat(completionRate.toFixed(1)),
      totalTimeSpentMinutes: Math.round(totalTimeSpent / 60),
      insights: aiData.insights,
      recommendations: aiData.recommendations,
      aiSummary: aiData.summary,
      generatedAt: new Date(),
    };
  }

  async getClassAIAnalytics(
    classroomId: string,
    period: AnalyticsPeriod = AnalyticsPeriod.LAST_30_DAYS,
  ): Promise<ClassAnalyticsResponse> {
    // 1. Validate classroom exists
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      select: {
        id: true,
        name: true,
        students: {
          where: { isActive: true },
          select: {
            student: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }

    const totalStudents = classroom.students.length;
    const studentIds = classroom.students.map((s) => s.student.id);

    // 2. Calculate date range
    const dateRange = this.getDateRange(period);

    // 3. Fetch class progress data
    const classProgress = await this.prisma.progress.findMany({
      where: {
        userId: { in: studentIds },
        updatedAt: { gte: dateRange },
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        activity: {
          select: {
            type: true,
            title: true,
          },
        },
      },
    });

    // 4. Aggregate class statistics
    const totalActivities = classProgress.length;
    const completedActivities = classProgress.filter(
      (p) => p.state === 'done',
    ).length;
    const totalScore = classProgress.reduce((sum, p) => sum + (p.score || 0), 0);

    const classAverageScore =
      totalActivities > 0 ? totalScore / totalActivities : 0;
    const classCompletionRate =
      totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0;

    // 5. Identify struggling students
    const studentPerformance: Record<
      string,
      {
        name: string;
        totalScore: number;
        activities: number;
      }
    > = {};

    classProgress.forEach((p) => {
      const studentId = p.userId;
      if (!studentPerformance[studentId]) {
        const student = p.user;
        studentPerformance[studentId] = {
          name:
            student.displayName ||
            [student.firstName, student.lastName].filter(Boolean).join(' ') ||
            'Student',
          totalScore: 0,
          activities: 0,
        };
      }
      studentPerformance[studentId].totalScore += p.score || 0;
      studentPerformance[studentId].activities++;
    });

    const strugglingStudents: StrugglingStudent[] = Object.entries(
      studentPerformance,
    )
      .map(([id, data]) => ({
        studentId: id,
        studentName: data.name,
        averageScore: data.activities > 0 ? data.totalScore / data.activities : 0,
        issue: '',
      }))
      .filter((s) => s.averageScore < 70)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 5);

    // 6. Generate AI insights using Gemini
    const prompt = `Bạn là một chuyên gia phân tích giáo dục. Dựa trên dữ liệu học tập của cả lớp học sau đây, hãy phân tích và đưa ra nhận xét chi tiết.

Thông tin lớp học:
- Tên lớp: ${classroom.name}
- Số học viên: ${totalStudents}
- Thời gian phân tích: ${this.getPeriodLabel(period)}
- Tổng số hoạt động học tập: ${totalActivities}
- Hoạt động hoàn thành: ${completedActivities} (${classCompletionRate.toFixed(1)}%)
- Điểm trung bình lớp: ${classAverageScore.toFixed(1)}/100
- Số học viên gặp khó khăn (điểm < 70): ${strugglingStudents.length}

${strugglingStudents.length > 0 ? `Học viên cần hỗ trợ:\n${strugglingStudents.map((s) => `- ${s.studentName}: ${s.averageScore.toFixed(1)}/100`).join('\n')}` : ''}

Yêu cầu:
1. Đánh giá tổng quan về tiến độ học tập của lớp
2. Xác định các điểm mạnh và điểm cần cải thiện của lớp
3. Đưa ra khuyến nghị cho giáo viên để cải thiện chất lượng giảng dạy
4. Nếu có học viên gặp khó khăn, đề xuất cách hỗ trợ

Trả về kết quả dưới dạng JSON với cấu trúc:
{
  "insights": [
    { "category": "Điểm mạnh", "insight": "...", "sentiment": "positive" },
    { "category": "Điểm cần cải thiện", "insight": "...", "sentiment": "neutral" }
  ],
  "recommendations": [
    { "title": "...", "description": "...", "priority": "high|medium|low" }
  ],
  "summary": "Tóm tắt tổng quan (2-3 câu)",
  "strugglingStudentsAnalysis": [
    { "studentId": "...", "issue": "Mô tả ngắn gọn vấn đề" }
  ]
}`;

    const aiResponse = await this.geminiService.generateResponse(prompt);
    const aiData = this.parseAIResponse(aiResponse);

    // Update struggling students with AI-generated issues
    if (aiData.strugglingStudentsAnalysis) {
      aiData.strugglingStudentsAnalysis.forEach((analysis: any) => {
        const student = strugglingStudents.find(
          (s) => s.studentId === analysis.studentId,
        );
        if (student) {
          student.issue = analysis.issue;
        }
      });
    }

    return {
      classroomId,
      classroomName: classroom.name,
      totalStudents,
      classAverageScore: parseFloat(classAverageScore.toFixed(1)),
      classCompletionRate: parseFloat(classCompletionRate.toFixed(1)),
      strugglingStudents,
      insights: aiData.insights,
      recommendations: aiData.recommendations,
      aiSummary: aiData.summary,
      generatedAt: new Date(),
    };
  }

  private getDateRange(period: AnalyticsPeriod): Date {
    const now = new Date();
    switch (period) {
      case AnalyticsPeriod.LAST_7_DAYS:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case AnalyticsPeriod.LAST_30_DAYS:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case AnalyticsPeriod.LAST_90_DAYS:
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case AnalyticsPeriod.ALL_TIME:
      default:
        return new Date(0); // Beginning of time
    }
  }

  private getPeriodLabel(period: AnalyticsPeriod): string {
    switch (period) {
      case AnalyticsPeriod.LAST_7_DAYS:
        return '7 ngày qua';
      case AnalyticsPeriod.LAST_30_DAYS:
        return '30 ngày qua';
      case AnalyticsPeriod.LAST_90_DAYS:
        return '90 ngày qua';
      case AnalyticsPeriod.ALL_TIME:
      default:
        return 'Toàn bộ thời gian';
    }
  }

  private parseAIResponse(response: string): {
    insights: AnalyticsInsight[];
    recommendations: AnalyticsRecommendation[];
    summary: string;
    strugglingStudentsAnalysis?: Array<{ studentId: string; issue: string }>;
  } {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          insights: parsed.insights || [],
          recommendations: parsed.recommendations || [],
          summary: parsed.summary || 'Không có tóm tắt.',
          strugglingStudentsAnalysis: parsed.strugglingStudentsAnalysis,
        };
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error);
    }

    // Fallback
    return {
      insights: [
        {
          category: 'Thông tin',
          insight: 'Không thể phân tích dữ liệu lúc này.',
          sentiment: 'neutral',
        },
      ],
      recommendations: [
        {
          title: 'Tiếp tục học tập',
          description: 'Hãy tiếp tục nỗ lực học tập.',
          priority: 'medium',
        },
      ],
      summary: 'Phân tích AI tạm thời không khả dụng.',
    };
  }
}

// ---------- Helper ----------

function safeJsonParse<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === 'object') return value as T;

  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return null;
  }
}
