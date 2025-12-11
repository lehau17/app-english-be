import { PrismaRepository } from '@app/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ProgressTrackerTool {
  private readonly logger = new Logger(ProgressTrackerTool.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly prisma: PrismaRepository) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'track_progress',
      description: `Theo doi tien do hoc tap cua hoc vien. Su dung khi nguoi dung hoi ve:
- "tien do hoc tap cua toi", "toi da hoc duoc gi"
- "toi con bao nhieu bai chua hoc"
- "streak hoc tap", "thoi gian hoc"
- "diem so cua toi", "ket qua bai tap"
- "khoa hoc nao toi dang hoc", "tien do khoa hoc"
- "tu vung da hoc", "podcast da nghe"`,
      schema: z.object({
        userId: z.string().describe('ID cua hoc vien'),
        period: z
          .enum(['7d', '30d', '90d', 'all'])
          .optional()
          .default('30d')
          .describe('Khoang thoi gian'),
      }),
      func: async ({ userId, period = '30d' }) => {
        return this._call(JSON.stringify({ userId, period }));
      },
    });
  }

  private async _call(input: string): Promise<string> {
    try {
      const params = this.parseInput(input);

      if (!params.userId) {
        return JSON.stringify({
          success: false,
          error: 'Cần userId để theo dõi tiến độ',
        });
      }

      const data = await this.gatherProgressData(params.userId, params.period);
      const aiInsights = await this.analyzeWithAI(data);
      const charts = this.generateCharts(data);

      return JSON.stringify({
        success: true,
        data: {
          summary: data.summary,
          insights: aiInsights,
          charts,
          details: {
            courses: data.courses,
            recentActivities: data.recentActivities,
            vocabulary: data.vocabulary,
            podcasts: data.podcasts,
            assignments: data.assignments,
            speaking: data.speaking,
          },
        },
      });
    } catch (error) {
      this.logger.error('Progress tracker error:', error);
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }

  private parseInput(input: string): { userId?: string; period: string } {
    try {
      const parsed = JSON.parse(input);
      return {
        userId: parsed.userId,
        period: parsed.period || '30d',
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

  private async gatherProgressData(userId: string, period: string) {
    const dateFilter = this.getDateFilter(period);

    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        Profile: true,
      },
    });

    if (!user) {
      throw new Error('Không tìm thấy người dùng');
    }

    // Get classroom enrollments
    const classroomStudents = await this.prisma.classroomStudent.findMany({
      where: { studentId: userId, isActive: true },
      include: {
        classroom: {
          include: {
            course: {
              include: {
                lessons: {
                  include: {
                    activities: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Get activity progress
    const progressRecords = await this.prisma.progress.findMany({
      where: {
        userId,
        ...(dateFilter && { updatedAt: { gte: dateFilter } }),
      },
      include: {
        activity: {
          include: {
            lesson: {
              include: {
                course: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get attempts
    const attempts = await this.prisma.attempt.findMany({
      where: {
        userId,
        ...(dateFilter && { createdAt: { gte: dateFilter } }),
      },
      include: {
        activity: {
          include: {
            lesson: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get assignment submissions
    const submissions = await this.prisma.assignmentSubmission.findMany({
      where: {
        studentId: userId,
        ...(dateFilter && { submittedAt: { gte: dateFilter } }),
      },
      include: {
        assignment: {
          include: {
            classroom: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Get vocabulary progress
    const vocabProgress = await this.prisma.userVocabularyProgress.findMany({
      where: {
        userId,
        ...(dateFilter && { updatedAt: { gte: dateFilter } }),
      },
      include: {
        term: {
          include: {
            unit: {
              include: {
                list: true,
              },
            },
          },
        },
      },
    });

    // Get podcast attempts
    const podcastAttempts = await this.prisma.podcastAttempt.findMany({
      where: {
        userId,
        ...(dateFilter && { createdAt: { gte: dateFilter } }),
      },
      include: {
        podcast: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get AI speaking sessions
    const speakingSessions = await this.prisma.aiSpeakingSession.findMany({
      where: {
        userId,
        ...(dateFilter && { createdAt: { gte: dateFilter } }),
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get study sessions
    const studySessions = await this.prisma.studySession.findMany({
      where: {
        userId,
        ...(dateFilter && { startTime: { gte: dateFilter } }),
      },
    });

    // Calculate summary
    const totalStudyTime = studySessions.reduce(
      (sum, s) => sum + (s.durationMinutes || 0),
      0,
    );
    const streak = user.Profile?.studyStreak || 0;

    // Course progress calculation
    const courses = classroomStudents.map((cs) => {
      const course = cs.classroom.course;
      const totalActivities = course.lessons.reduce(
        (sum, l) => sum + l.activities.length,
        0,
      );
      const completedActivities = progressRecords.filter(
        (p) => p.activity.lesson.courseId === course.id && p.state === 'done',
      ).length;
      const progressPercent =
        totalActivities > 0
          ? Math.round((completedActivities / totalActivities) * 100)
          : 0;

      return {
        id: course.id,
        title: course.title,
        classroomName: cs.classroom.name,
        totalLessons: course.lessons.length,
        totalActivities,
        completedActivities,
        progressPercent,
        joinedAt: cs.joinedAt,
      };
    });

    // Vocabulary summary
    const vocabStats = {
      totalLearned: vocabProgress.length,
      mastered: vocabProgress.filter((v) => v.status === 'mastered').length,
      learning: vocabProgress.filter((v) => v.status === 'learning').length,
      review: vocabProgress.filter((v) => v.status === 'review').length,
      new: vocabProgress.filter((v) => v.status === 'new').length,
    };

    // Podcast summary
    const podcastStats = {
      totalAttempts: podcastAttempts.length,
      completed: podcastAttempts.filter((p) => p.status === 'completed').length,
      avgScore:
        podcastAttempts.length > 0
          ? Math.round(
              podcastAttempts.reduce(
                (sum, p) => sum + (p.scorePercent || 0),
                0,
              ) / podcastAttempts.length,
            )
          : 0,
    };

    // Assignment summary
    const assignmentStats = {
      totalSubmitted: submissions.length,
      avgScore:
        submissions.filter((s) => s.score !== null).length > 0
          ? Math.round(
              submissions
                .filter((s) => s.score !== null)
                .reduce((sum, s) => sum + (s.score || 0), 0) /
                submissions.filter((s) => s.score !== null).length,
            )
          : 0,
      onTime: submissions.filter((s) => !s.isLate).length,
      late: submissions.filter((s) => s.isLate).length,
    };

    // Speaking summary
    const speakingStats = {
      totalSessions: speakingSessions.length,
      completed: speakingSessions.filter((s) => s.state === 'finished').length,
      totalTurns: speakingSessions.reduce((sum, s) => sum + s.turnCount, 0),
    };

    // Recent activities for timeline
    const recentActivities = [
      ...progressRecords.slice(0, 5).map((p) => ({
        type: 'activity',
        title: p.activity.title,
        lessonTitle: p.activity.lesson.title,
        state: p.state,
        score: p.score,
        date: p.updatedAt,
      })),
      ...submissions.slice(0, 5).map((s) => ({
        type: 'assignment',
        title: s.assignment.title,
        classroomName: s.assignment.classroom.name,
        score: s.score,
        isLate: s.isLate,
        date: s.submittedAt,
      })),
      ...podcastAttempts.slice(0, 5).map((p) => ({
        type: 'podcast',
        title: p.podcast.title,
        score: p.scorePercent,
        status: p.status,
        date: p.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    // Daily activity for chart
    const dailyActivity: Record<
      string,
      { activities: number; studyMinutes: number }
    > = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    last7Days.forEach((day) => {
      dailyActivity[day] = { activities: 0, studyMinutes: 0 };
    });

    progressRecords.forEach((p) => {
      const day = p.updatedAt.toISOString().split('T')[0];
      if (dailyActivity[day]) {
        dailyActivity[day].activities++;
      }
    });

    studySessions.forEach((s) => {
      const day = s.startTime.toISOString().split('T')[0];
      if (dailyActivity[day]) {
        dailyActivity[day].studyMinutes += s.durationMinutes || 0;
      }
    });

    return {
      user: {
        name:
          user.displayName ||
          `${user.firstName} ${user.lastName}`.trim() ||
          user.email,
        streak,
        totalStudyTime,
      },
      summary: {
        coursesEnrolled: courses.length,
        activitiesCompleted: progressRecords.filter((p) => p.state === 'done')
          .length,
        totalAttempts: attempts.length,
        avgScore:
          attempts.filter((a) => a.score !== null).length > 0
            ? Math.round(
                attempts
                  .filter((a) => a.score !== null)
                  .reduce((sum, a) => sum + (a.score || 0), 0) /
                  attempts.filter((a) => a.score !== null).length,
              )
            : 0,
        streak,
        totalStudyTimeMinutes: totalStudyTime,
      },
      courses,
      recentActivities,
      vocabulary: vocabStats,
      podcasts: podcastStats,
      assignments: assignmentStats,
      speaking: speakingStats,
      dailyActivity: Object.entries(dailyActivity).map(([date, data]) => ({
        date,
        ...data,
      })),
    };
  }

  private async analyzeWithAI(data: any): Promise<any> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const prompt = `Phân tích tiến độ học tập của học viên và đưa ra nhận xét, gợi ý:

${JSON.stringify(data, null, 2)}

Trả về JSON với format:
{
  "summary": "Tóm tắt tiến độ học tập tổng quan",
  "strengths": ["Điểm mạnh của học viên"],
  "improvements": ["Điểm cần cải thiện"],
  "recommendations": ["Gợi ý cụ thể để học tốt hơn"],
  "motivation": "Lời động viên phù hợp với tiến độ",
  "nextSteps": ["Các bước tiếp theo nên làm"]
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

    // Chart 1: Line - Daily activity trend
    if (data.dailyActivity && data.dailyActivity.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'line',
        title: 'Hoạt động 7 ngày qua',
        data: data.dailyActivity.map((d: any) => ({
          name: d.date.substring(5), // MM-DD format
          'Bài học': d.activities,
          'Phút học': d.studyMinutes,
        })),
        config: {
          xAxisKey: 'name',
          lines: [
            { dataKey: 'Bài học', color: '#3B82F6', strokeWidth: 2 },
            { dataKey: 'Phút học', color: '#10B981', strokeWidth: 2 },
          ],
        },
      });
    }

    // Chart 2: Bar - Course progress
    if (data.courses && data.courses.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'bar',
        title: 'Tiến độ khóa học',
        data: data.courses.map((c: any) => ({
          name: c.title.substring(0, 20),
          'Hoàn thành (%)': c.progressPercent,
        })),
        config: {
          xAxisKey: 'name',
          bars: [{ dataKey: 'Hoàn thành (%)', color: '#8B5CF6' }],
        },
      });
    }

    // Chart 3: Pie - Vocabulary status
    if (data.vocabulary && data.vocabulary.totalLearned > 0) {
      const vocabData = [
        { name: 'Đã thuộc', value: data.vocabulary.mastered },
        { name: 'Đang học', value: data.vocabulary.learning },
        { name: 'Cần ôn', value: data.vocabulary.review },
        { name: 'Mới', value: data.vocabulary.new },
      ].filter((d) => d.value > 0);

      if (vocabData.length > 0) {
        charts.push({
          type: 'chart',
          chartType: 'pie',
          title: 'Trạng thái từ vựng',
          data: vocabData,
          config: {
            colors: ['#10B981', '#3B82F6', '#F59E0B', '#6B7280'],
          },
        });
      }
    }

    // Chart 4: Radar - Skills overview
    const skillsData = [
      {
        subject: 'Bài tập',
        score: data.assignments.avgScore || 0,
        fullMark: 100,
      },
      { subject: 'Podcast', score: data.podcasts.avgScore || 0, fullMark: 100 },
      {
        subject: 'Từ vựng',
        score:
          data.vocabulary.totalLearned > 0
            ? Math.round(
                (data.vocabulary.mastered / data.vocabulary.totalLearned) * 100,
              )
            : 0,
        fullMark: 100,
      },
      {
        subject: 'Luyện nói',
        score:
          data.speaking.totalSessions > 0
            ? Math.round(
                (data.speaking.completed / data.speaking.totalSessions) * 100,
              )
            : 0,
        fullMark: 100,
      },
    ];

    charts.push({
      type: 'chart',
      chartType: 'radar',
      title: 'Tổng quan kỹ năng',
      data: skillsData,
      config: {
        radars: [{ dataKey: 'score', color: '#6366F1' }],
      },
    });

    return charts;
  }
}
