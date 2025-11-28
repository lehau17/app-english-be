import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { AiSpeakingSessionState } from '@prisma/client';
import { Tool } from 'langchain/tools';

@Injectable()
export class StudentAnalyticsTool extends Tool {
  name = 'analyze_student';
  description = `Phân tích chi tiết một học viên/học sinh cụ thể với AI và tạo nhiều biểu đồ trực quan.

Input: JSON string với một trong các trường sau:
- {"studentEmail": "student@gmail.com"} - tìm theo email
- {"studentName": "Nguyễn Văn A"} - tìm theo tên
- {"studentId": "uuid-here"} - tìm theo ID
- {"period": "week|month|quarter|all"} - khoảng thời gian (mặc định: month)

Sử dụng tool này khi:
- Người dùng hỏi "phân tích học viên/học sinh X"
- Người dùng hỏi "tiến độ của học sinh email abc@gmail.com"
- Người dùng hỏi "điểm số học viên tên Nguyễn Văn A"
- Người dùng muốn xem kỹ năng, điểm mạnh/yếu của học viên

Kết quả trả về:
- Thông tin học viên (tên, email)
- Metrics: điểm TB, tỷ lệ hoàn thành, thời gian học, streak
- Skill breakdown: 6 kỹ năng (Grammar, Vocabulary, Listening, Speaking, Reading, Writing)
- AI Insights: phân tích điểm mạnh, điểm yếu, xu hướng
- Recommendations: gợi ý cải thiện
- 3-4 biểu đồ: line (xu hướng điểm), radar (kỹ năng), pie (hoạt động), bar (completion)`;

  private readonly logger = new Logger(StudentAnalyticsTool.name);

  constructor(
    private prisma: PrismaRepository,
    private gemini: GeminiService,
  ) {
    super();
  }

  async _call(input: string): Promise<string> {
    try {
      this.logger.log(`Student Analytics input: ${input}`);

      const parsedInput = JSON.parse(input);
      let {
        studentId,
        studentName,
        studentEmail,
        period = 'month',
        includeCharts = true,
      } = parsedInput;

      // 1. Find student if only name/email provided
      if (!studentId && (studentName || studentEmail)) {
        const whereClause: any = { role: 'student' };

        if (studentEmail) {
          whereClause.email = {
            contains: studentEmail,
            mode: 'insensitive',
          };
        } else if (studentName) {
          whereClause.OR = [
            { displayName: { contains: studentName, mode: 'insensitive' } },
            { firstName: { contains: studentName, mode: 'insensitive' } },
            { lastName: { contains: studentName, mode: 'insensitive' } },
          ];
        }

        const student = await this.prisma.user.findFirst({
          where: whereClause,
        });

        if (!student) {
          return JSON.stringify({
            success: false,
            error: `Không tìm thấy học viên với thông tin: ${studentName || studentEmail}`,
          });
        }

        studentId = student.id;
      }

      if (!studentId) {
        return JSON.stringify({
          success: false,
          error: 'Vui lòng cung cấp studentId, studentName hoặc studentEmail',
        });
      }

      // 2. Query student data
      const studentData = await this.getStudentData(studentId, period);

      if (!studentData.student) {
        return JSON.stringify({
          success: false,
          error: 'Không tìm thấy học viên',
        });
      }

      // 3. Send to Gemini for AI analysis
      const aiAnalysis = await this.analyzeStudentWithAI(studentData);

      // 4. Generate multiple charts if requested
      let charts: any[] = [];
      if (includeCharts) {
        charts = this.generateStudentCharts(studentData);
      }

      // 5. Return comprehensive analysis
      return JSON.stringify({
        success: true,
        student: {
          id: studentData.student.id,
          name:
            studentData.student.displayName ||
            `${studentData.student.firstName || ''} ${studentData.student.lastName || ''}`.trim(),
          email: studentData.student.email,
        },
        metrics: {
          totalAssignments: studentData.totalAssignments,
          completedAssignments: studentData.completedAssignments,
          averageScore: studentData.averageScore,
          completionRate: studentData.completionRate,
          studyTime: studentData.studyTime,
          streak: studentData.streak,
          vocabularyMastered: studentData.vocabularyMastered,
          podcastsCompleted: studentData.podcastsCompleted,
          speakingSessions: studentData.speakingSessionsCount,
        },
        skillBreakdown: studentData.skillBreakdown,
        aiInsights: aiAnalysis.insights,
        recommendations: aiAnalysis.recommendations,
        summary: aiAnalysis.summary,
        charts, // Array of 3-5 charts
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Student analytics error: ${error.message}`, error.stack);
      return JSON.stringify({
        success: false,
        error: `Lỗi phân tích học viên: ${error.message}`,
      });
    }
  }

  /**
   * Get comprehensive student data from database
   */
  private async getStudentData(studentId: string, period: string) {
    const startDate = this.getStartDate(period);

    const [
      student,
      submissions,
      vocabProgress,
      podcastAttempts,
      speakingSessions,
      classrooms,
    ] = await Promise.all([
      // Basic student info
      this.prisma.user.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      }),

      // Assignment submissions
      this.prisma.assignmentSubmission.findMany({
        where: {
          studentId,
          submittedAt: { gte: startDate },
          score: { not: null },
        },
        include: {
          assignment: {
            select: {
              id: true,
              title: true,
              totalPoints: true,
              type: true,
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      }),

      // Vocabulary progress
      this.prisma.userVocabularyProgress.findMany({
        where: {
          userId: studentId,
          updatedAt: { gte: startDate },
        },
        include: {
          term: {
            select: {
              word: true,
            },
          },
        },
      }),

      // Podcast attempts
      this.prisma.podcastAttempt.findMany({
        where: {
          userId: studentId,
          createdAt: { gte: startDate },
          status: {
            in: ['completed', 'in_progress', "submitted"],
          }
        },
        select: {
          id: true,
          scorePercent: true,
          createdAt: true,
          timeSpent: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      // AI Speaking sessions
      this.prisma.aiSpeakingSession.findMany({
        where: {
          userId: studentId,
          createdAt: { gte: startDate },
          state: {
            in:   [AiSpeakingSessionState.finished, AiSpeakingSessionState.ai_speaking, AiSpeakingSessionState.user_speaking],
          }
        },
        include: {
          turns: {
            where: { state: 'completed' },
            select: {
              score: true,
              metrics: true,
            },
          },
        },
      }),

      // Classrooms
      this.prisma.classroomStudent.findMany({
        where: {
          studentId,
          isActive: true,
        },
        include: {
          classroom: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // Calculate metrics
    const totalAssignments = submissions.length;
    const completedAssignments = submissions.filter((s) => s.score !== null).length;
    const completionRate =
      totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0;

    const totalScore = submissions.reduce((sum, s) => {
      const percentage = (s.score / s.assignment.totalPoints) * 100;
      return sum + percentage;
    }, 0);
    const averageScore = totalAssignments > 0 ? totalScore / totalAssignments : 0;

    const studyTime =
      submissions.reduce((sum, s) => sum + (s.timeSpent || 0), 0) +
      podcastAttempts.reduce((sum, p) => sum + (p.timeSpent || 0), 0) +
      speakingSessions.length * 5;

    const vocabularyMastered = vocabProgress.filter(
      (v) => v.status === 'mastered',
    ).length;

    // Calculate streak
    const streak = await this.calculateStreak(studentId);

    // Skill breakdown
    const grammarScore = this.calculateSkillScoreByType(submissions, 'grammar');
    const vocabScore = this.calculateSkillScoreByType(submissions, 'vocabulary') ||
      (vocabularyMastered > 0 ? Math.min((vocabularyMastered / 100) * 100, 100) : 0);
    const listeningScore =
      podcastAttempts.length > 0
        ? podcastAttempts.reduce((sum, p) => sum + (p.scorePercent || 0), 0) / podcastAttempts.length
        : 0;
    const speakingScore = this.calculateSpeakingScore(speakingSessions);
    const readingScore = this.calculateSkillScoreByType(submissions, 'reading');
    const writingScore = this.calculateSkillScoreByType(submissions, 'writing');

    return {
      student,
      totalAssignments,
      completedAssignments,
      averageScore: Math.round(averageScore * 10) / 10,
      completionRate: Math.round(completionRate * 10) / 10,
      studyTime: Math.round(studyTime),
      streak,
      vocabularyMastered,
      podcastsCompleted: podcastAttempts.length,
      speakingSessionsCount: speakingSessions.length,
      submissions,
      vocabProgress,
      podcastAttempts,
      speakingSessions,
      classrooms,
      skillBreakdown: {
        grammar: Math.round(grammarScore),
        vocabulary: Math.round(vocabScore),
        listening: Math.round(listeningScore),
        speaking: Math.round(speakingScore),
        reading: Math.round(readingScore),
        writing: Math.round(writingScore),
      },
    };
  }

  /**
   * Analyze student data with Gemini AI
   */
  private async analyzeStudentWithAI(data: any) {
    const prompt = `Bạn là chuyên gia phân tích giáo dục. Phân tích học viên với dữ liệu sau:

**Thông tin học viên:**
- Tên: ${data.student.displayName || data.student.firstName + ' ' + data.student.lastName}
- Email: ${data.student.email}

**Chỉ số học tập:**
- Tổng số bài tập: ${data.totalAssignments}
- Bài tập đã hoàn thành: ${data.completedAssignments}
- Điểm trung bình: ${data.averageScore}%
- Tỷ lệ hoàn thành: ${data.completionRate}%
- Thời gian học: ${data.studyTime} phút
- Streak: ${data.streak} ngày
- Từ vựng đã thành thạo: ${data.vocabularyMastered}
- Podcast đã hoàn thành: ${data.podcastsCompleted}
- Buổi Speaking: ${data.speakingSessions}

**Phân tích kỹ năng (0-100):**
- Grammar: ${data.skillBreakdown.grammar}
- Vocabulary: ${data.skillBreakdown.vocabulary}
- Listening: ${data.skillBreakdown.listening}
- Speaking: ${data.skillBreakdown.speaking}
- Reading: ${data.skillBreakdown.reading}
- Writing: ${data.skillBreakdown.writing}

Hãy đưa ra phân tích chuyên sâu với:
1. **Insights** (3-5 điểm): Phân tích điểm mạnh, điểm yếu, xu hướng học tập
2. **Recommendations** (3-4 điểm): Gợi ý cụ thể để cải thiện
3. **Summary** (2-3 câu): Tóm tắt tổng quan về học viên

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
  "summary": "Tóm tắt tổng quan về học viên..."
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
            insight: `Học viên có ${data.totalAssignments} bài tập với điểm trung bình ${data.averageScore}%`,
            sentiment: 'neutral',
          },
        ],
        recommendations: [
          {
            title: 'Tiếp tục học tập',
            description: 'Duy trì tiến độ học tập hiện tại',
            priority: 'medium',
          },
        ],
        summary: `Học viên đang có tiến độ học tập ${data.completionRate >= 70 ? 'tốt' : 'cần cải thiện'}.`,
      };
    }
  }

  /**
   * Generate multiple charts for student analytics
   */
  private generateStudentCharts(data: any): any[] {
    const charts: any[] = [];

    // Chart 1: Score progression (Line chart)
    if (data.submissions.length > 0) {
      const scoreData = data.submissions
        .slice()
        .reverse()
        .slice(0, 15)
        .map((s, idx) => ({
          name: `Bài ${idx + 1}`,
          value: Math.round((s.score / s.assignment.totalPoints) * 100),
        }));

      charts.push({
        type: 'chart',
        chartType: 'line',
        title: 'Xu hướng điểm số (15 bài gần nhất)',
        data: scoreData,
        config: {
          xLabel: 'Bài tập',
          yLabel: 'Điểm (%)',
          colors: ['#3b82f6'],
          legend: true,
          responsive: true,
        },
      });
    }

    // Chart 2: Skill breakdown (Radar chart)
    charts.push({
      type: 'chart',
      chartType: 'radar',
      title: 'Phân tích 6 kỹ năng',
      data: [
        { name: 'Grammar', value: data.skillBreakdown.grammar },
        { name: 'Vocabulary', value: data.skillBreakdown.vocabulary },
        { name: 'Listening', value: data.skillBreakdown.listening },
        { name: 'Speaking', value: data.skillBreakdown.speaking },
        { name: 'Reading', value: data.skillBreakdown.reading },
        { name: 'Writing', value: data.skillBreakdown.writing },
      ],
      config: {
        colors: ['#10b981'],
        legend: true,
        responsive: true,
      },
    });

    // Chart 3: Activity distribution (Pie chart)
    const activityData = [
      { name: 'Bài tập', value: data.completedAssignments },
      { name: 'Podcasts', value: data.podcastsCompleted },
      { name: 'Từ vựng', value: data.vocabularyMastered },
      { name: 'Speaking', value: data.speakingSessionsCount },
    ].filter((item) => item.value > 0);

    if (activityData.length > 0) {
      charts.push({
        type: 'chart',
        chartType: 'pie',
        title: 'Phân bố hoạt động học tập',
        data: activityData,
        config: {
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
          legend: true,
          responsive: true,
        },
      });
    }

    // Chart 4: Completion rate by assignment type (Bar chart)
    if (data.submissions.length > 0) {
      const typeMap = new Map<string, { total: number; completed: number }>();

      data.submissions.forEach((s) => {
        const type = s.assignment.type || 'OTHER';
        if (!typeMap.has(type)) {
          typeMap.set(type, { total: 0, completed: 0 });
        }
        const stats = typeMap.get(type)!;
        stats.total++;
        if (s.score !== null) stats.completed++;
      });

      const typeData = Array.from(typeMap.entries()).map(([type, stats]) => ({
        name: type,
        value: Math.round((stats.completed / stats.total) * 100),
      }));

      if (typeData.length > 0) {
        charts.push({
          type: 'chart',
          chartType: 'bar',
          title: 'Tỷ lệ hoàn thành theo loại bài',
          data: typeData,
          config: {
            xLabel: 'Loại bài tập',
            yLabel: 'Tỷ lệ (%)',
            colors: ['#8b5cf6'],
            legend: false,
            responsive: true,
          },
        });
      }
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

  private calculateSkillScoreByType(submissions: any[], skillKeyword: string): number {
    const filtered = submissions.filter((s) =>
      s.assignment.title.toLowerCase().includes(skillKeyword.toLowerCase()),
    );

    if (filtered.length === 0) return 0;

    const totalScore = filtered.reduce((sum, s) => {
      const percentage = (s.score / s.assignment.totalPoints) * 100;
      return sum + percentage;
    }, 0);

    return totalScore / filtered.length;
  }

  private calculateSpeakingScore(sessions: any[]): number {
    if (sessions.length === 0) return 0;

    const allScores: number[] = [];
    sessions.forEach((s) => {
      s.turns.forEach((t: any) => {
        // Use score field directly (0-100)
        if (t.score) allScores.push(t.score);
      });
    });

    if (allScores.length === 0) return 0;

    return allScores.reduce((a, b) => a + b, 0) / allScores.length;
  }

  private async calculateStreak(userId: string): Promise<number> {
    const submissions = await this.prisma.assignmentSubmission.findMany({
      where: { studentId: userId },
      select: { submittedAt: true },
      orderBy: { submittedAt: 'desc' },
    });

    if (submissions.length === 0) return 0;

    const dates = new Set<string>();
    submissions.forEach((s) => {
      if (s.submittedAt) {
        const date = new Date(s.submittedAt).toDateString();
        dates.add(date);
      }
    });

    const sortedDates = Array.from(dates)
      .map((d) => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sortedDates.length; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      checkDate.setHours(0, 0, 0, 0);

      const found = sortedDates.find(
        (d) => d.toDateString() === checkDate.toDateString(),
      );

      if (found) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
