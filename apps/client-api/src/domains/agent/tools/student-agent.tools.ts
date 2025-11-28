import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { RagService } from '../service/rag.service';
import { SqlService } from '../service/sql.service';
import { ChartGeneratorTool } from './chart-generator.tool';
import { FlashcardReviewTool } from './flashcard-review.tool';
import { GrammarExplainerTool } from './grammar-explainer.tool';
import { PodcastHistoryTool } from './podcast-history.tool';
import { PronunciationCoachTool } from './pronunciation-coach.tool';
import { RagTool } from './rag.tool';
import { SqlTool } from './sql.tool';
import { UpcomingDeadlinesTool } from './upcoming-deadlines.tool';
import { VocabularyLookupTool } from './vocabulary-lookup.tool';

@Injectable()
export class StudentAgentTools {
  private readonly logger = new Logger(StudentAgentTools.name);

  constructor(
    private ragService: RagService,
    private sqlService: SqlService,
    private prisma: PrismaRepository,
    private chartTool: ChartGeneratorTool,
    private gemini: GeminiService,
  ) {}

  getTools() {
    // Initialize new learning tools
    const vocabularyLookup = new VocabularyLookupTool(
      this.prisma,
      this.gemini,
      this.ragService,
    );
    const grammarExplainer = new GrammarExplainerTool(
      this.gemini,
      this.ragService,
    );
    const pronunciationCoach = new PronunciationCoachTool(this.gemini);
    const flashcardReview = new FlashcardReviewTool(this.prisma, this.gemini);
    const upcomingDeadlines = new UpcomingDeadlinesTool(this.prisma);
    const podcastHistory = new PodcastHistoryTool(this.prisma);

    return [
      // Core tools
      new RagTool(this.ragService),
      new SqlTool(this.sqlService),
      this.chartTool,

      // Learning assistant tools (NEW!)
      vocabularyLookup.getTool(),
      grammarExplainer.getTool(),
      pronunciationCoach.getTool(),

      // Flashcard review tools (SRS)
      ...flashcardReview.getTools(),

      // Deadline tracker
      upcomingDeadlines.getTool(),

      // Podcast history
      podcastHistory.getTool(),

      // Progress tools
      this.getScoreReportTool(),
      this.getAdaptiveRecommendationTool(),
      this.getLearningAnalyticsTool(),
    ];
  }

  private getScoreReportTool() {
    return new DynamicStructuredTool({
      name: 'get_score_report',
      description:
        'Tạo báo cáo điểm số của học sinh với biểu đồ. Sử dụng khi học sinh hỏi về điểm số, thành tích, báo cáo học tập.',
      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
        limit: z.number().optional().default(10).describe('Số lượng bài tập'),
      }),
      func: async ({ userId, limit = 10 }) => {
        try {
          this.logger.log('Score report for user: ' + userId);

          const submissions = await this.prisma.assignmentSubmission.findMany({
            where: { studentId: userId, score: { not: null } },
            include: {
              assignment: { select: { title: true, totalPoints: true } },
            },
            orderBy: { submittedAt: 'desc' },
            take: limit,
          });

          if (submissions.length === 0) {
            return JSON.stringify({
              success: false,
              message: 'Chưa có bài được chấm điểm!',
            });
          }

          const scores = submissions.map((s) => s.score);
          const totalPoints = submissions.map((s) => s.assignment.totalPoints);
          const percentages = submissions.map(
            (s, idx) => (s.score / totalPoints[idx]) * 100,
          );
          const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          const avgPercentage =
            percentages.reduce((a, b) => a + b, 0) / percentages.length;

          const chartData = submissions.reverse().map((s, idx) => {
            const num = submissions.length - idx;
            return (
              'Bài ' + num + ': ' + s.score + '/' + s.assignment.totalPoints
            );
          });

          const chartPrompt =
            'Biểu đồ cột điểm số ' +
            submissions.length +
            ' bài tập. Dữ liệu: ' +
            chartData.join(', ');
          const chartResult = await this.chartTool._call(chartPrompt);

          return JSON.stringify({
            success: true,
            summary: {
              total: submissions.length,
              avg: avgScore.toFixed(1),
              avgPct: avgPercentage.toFixed(1) + '%',
              max: Math.max(...scores),
              min: Math.min(...scores),
            },
            chart: chartResult,
            insights: this.generateInsights(avgPercentage, percentages),
          });
        } catch (error) {
          this.logger.error('Score report error:', error);
          return JSON.stringify({ success: false, error: 'Lỗi tạo báo cáo' });
        }
      },
    });
  }

  private generateInsights(avgPct: number, pcts: number[]): string[] {
    const insights = [];
    if (avgPct >= 80) insights.push('Xuất sắc!');
    else if (avgPct >= 70) insights.push('Tốt!');
    else if (avgPct >= 50) insights.push('Cố gắng hơn!');
    else insights.push('Ôn tập nhiều hơn!');

    if (pcts.length >= 3) {
      const r3 = pcts.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const o3 = pcts.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      if (r3 > o3 + 10) insights.push('Điểm đang tăng!');
      else if (r3 < o3 - 10) insights.push('Cần cải thiện!');
    }
    return insights;
  }

  /**
   * Adaptive Recommendation Tool
   * Recommends lessons based on student's weak topics
   */
  private getAdaptiveRecommendationTool() {
    return new DynamicStructuredTool({
      name: 'recommend_lessons',
      description:
        'Gợi ý bài học phù hợp dựa trên điểm yếu và tiến độ của học sinh. Sử dụng khi học sinh hỏi "nên học gì tiếp", "bài học nào phù hợp", "làm sao cải thiện".',
      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
        focusArea: z
          .enum([
            'vocabulary',
            'grammar',
            'listening',
            'speaking',
            'reading',
            'writing',
            'all',
          ])
          .optional()
          .default('all')
          .describe('Lĩnh vực cần tập trung'),
        limit: z.number().optional().default(3).describe('Số lượng gợi ý'),
      }),
      func: async ({ userId, focusArea = 'all', limit = 3 }) => {
        try {
          this.logger.log(
            `Adaptive recommendation for user: ${userId}, focus: ${focusArea}`,
          );

          // 1. Analyze student's weak topics
          const submissions = await this.prisma.assignmentSubmission.findMany({
            where: { studentId: userId, score: { not: null } },
            select: {
              score: true,
              submittedAt: true,
              assignment: {
                select: {
                  id: true,
                  title: true,
                  totalPoints: true,
                  classroomId: true,
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
            take: 20,
          });

          if (submissions.length === 0) {
            // No submissions yet - recommend starter lessons
            const starterLessons = await this.prisma.lesson.findMany({
              where: {
                orderNo: { lte: 3 },
                isLocked: false,
              },
              select: {
                id: true,
                title: true,
                description: true,
                orderNo: true,
                course: { select: { title: true } },
              },
              take: limit,
              orderBy: { orderNo: 'asc' },
            });

            return JSON.stringify({
              success: true,
              reason: 'Học sinh mới, gợi ý bài cơ bản',
              recommendations: starterLessons.map((l) => ({
                lessonId: l.id,
                title: l.title,
                description: l.description,
                course: l.course?.title,
                order: l.orderNo,
                reason: 'Bài học nền tảng cho người mới bắt đầu',
                priority: 'high',
              })),
            });
          }

          // 2. Calculate weak topics
          const topicScores = new Map<
            string,
            { total: number; count: number; assignmentIds: Set<string> }
          >();

          submissions.forEach((sub) => {
            const topic = sub.assignment.title;
            const percentage = (sub.score / sub.assignment.totalPoints) * 100;
            const assignmentId = sub.assignment.id;

            if (!topicScores.has(topic)) {
              topicScores.set(topic, {
                total: 0,
                count: 0,
                assignmentIds: new Set(),
              });
            }

            const data = topicScores.get(topic)!;
            data.total += percentage;
            data.count += 1;
            data.assignmentIds.add(assignmentId);
          });

          const weakTopics = Array.from(topicScores.entries())
            .map(([topic, data]) => ({
              topic,
              avgScore: data.total / data.count,
              count: data.count,
              assignmentIds: Array.from(data.assignmentIds),
            }))
            .filter((t) => t.avgScore < 70)
            .sort((a, b) => a.avgScore - b.avgScore)
            .slice(0, 3);

          if (weakTopics.length === 0) {
            // Student doing well - recommend advanced lessons
            const advancedLessons = await this.prisma.lesson.findMany({
              where: {
                isLocked: false,
              },
              select: {
                id: true,
                title: true,
                description: true,
                orderNo: true,
                difficulty: true,
                course: { select: { title: true } },
              },
              take: limit,
              orderBy: { orderNo: 'desc' },
            });

            return JSON.stringify({
              success: true,
              reason: 'Học sinh đang học tốt, gợi ý bài nâng cao',
              weakTopics: [],
              recommendations: advancedLessons.map((l) => ({
                lessonId: l.id,
                title: l.title,
                description: l.description,
                course: l.course?.title,
                difficulty: l.difficulty,
                order: l.orderNo,
                reason: 'Bài học nâng cao để tiếp tục phát triển',
                priority: 'medium',
              })),
            });
          }

          // 3. Find lessons related to weak topics
          const searchKeywords = weakTopics.map((t) => t.topic).join(' ');

          const recommendedLessons = await this.prisma.lesson.findMany({
            where: {
              OR: [
                { title: { contains: searchKeywords, mode: 'insensitive' } },
                {
                  description: {
                    contains: searchKeywords,
                    mode: 'insensitive',
                  },
                },
              ],
              isLocked: false,
            },
            select: {
              id: true,
              title: true,
              description: true,
              orderNo: true,
              difficulty: true,
              course: {
                select: {
                  title: true,
                },
              },
            },
            take: limit * 2, // Get more to filter
            orderBy: { orderNo: 'asc' },
          });

          // 4. Match lessons to weak topics
          const recommendations = recommendedLessons
            .slice(0, limit)
            .map((lesson) => {
              const matchedTopic = weakTopics.find((t) =>
                lesson.title.toLowerCase().includes(t.topic.toLowerCase()),
              );

              return {
                lessonId: lesson.id,
                title: lesson.title,
                description: lesson.description,
                course: lesson.course?.title,
                difficulty: lesson.difficulty,
                order: lesson.orderNo,
                weakTopic: matchedTopic?.topic,
                currentScore: matchedTopic?.avgScore.toFixed(1),
                reason: matchedTopic
                  ? `Giúp cải thiện "${matchedTopic.topic}" (điểm hiện tại: ${matchedTopic.avgScore.toFixed(1)})`
                  : 'Bài học liên quan đến chủ đề yếu',
                priority: matchedTopic ? 'high' : 'medium',
              };
            });

          return JSON.stringify({
            success: true,
            reason: `Phát hiện ${weakTopics.length} chủ đề cần cải thiện`,
            weakTopics: weakTopics.map((t) => ({
              topic: t.topic,
              avgScore: t.avgScore.toFixed(1),
              attempts: t.count,
            })),
            recommendations,
            suggestion:
              'Nên tập trung ôn tập các bài học này để cải thiện điểm số.',
          });
        } catch (error) {
          this.logger.error('Adaptive recommendation error:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể tạo gợi ý',
            message: 'Vui lòng thử lại sau',
          });
        }
      },
    });
  }

  /**
   * Learning Analytics Tool
   * Comprehensive learning statistics and analytics dashboard
   */
  private getLearningAnalyticsTool() {
    return new DynamicStructuredTool({
      name: 'learning_analytics',
      description:
        'Thống kê học tập chi tiết với biểu đồ, xu hướng, dự đoán và gợi ý cải thiện. Sử dụng khi học sinh hỏi về "thống kê học tập", "tiến độ", "điểm mạnh yếu", "cần học gì tiếp".',
      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
        timeRange: z
          .enum(['week', 'month', 'quarter', 'year', 'all-time'])
          .optional()
          .default('month')
          .describe('Khoảng thời gian thống kê'),
        includeCharts: z
          .boolean()
          .optional()
          .default(true)
          .describe('Bao gồm dữ liệu biểu đồ'),
        includePrediction: z
          .boolean()
          .optional()
          .default(true)
          .describe('Bao gồm dự đoán trình độ'),
      }),
      func: async ({
        userId,
        timeRange = 'month',
        includeCharts = true,
        includePrediction = true,
      }) => {
        try {
          this.logger.log(
            `Learning analytics for user: ${userId}, range: ${timeRange}`,
          );

          // Calculate date range
          const now = new Date();
          const startDate = this.getStartDate(now, timeRange);

          // 1. Assignment Submissions
          const submissions = await this.prisma.assignmentSubmission.findMany({
            where: {
              studentId: userId,
              submittedAt: { gte: startDate },
              score: { not: null },
            },
            include: {
              assignment: {
                select: {
                  title: true,
                  totalPoints: true,
                  type: true,
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
          });

          // 2. Vocabulary Progress
          const vocabProgress =
            await this.prisma.userVocabularyProgress.findMany({
              where: {
                userId,
                updatedAt: { gte: startDate },
              },
              include: {
                term: {
                  include: {
                    unit: {
                      include: {
                        list: {
                          select: {
                            title: true,
                            difficulty: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            });

          // 3. Podcast Attempts
          const podcastAttempts = await this.prisma.podcastAttempt.findMany({
            where: {
              userId,
              status: 'submitted',
              createdAt: { gte: startDate },
            },
            select: {
              id: true,
              scorePercent: true,
              createdAt: true,
              timeSpent: true,
            },
            orderBy: { createdAt: 'desc' },
          });

          // 4. AI Speaking Sessions
          const speakingSessions = await this.prisma.aiSpeakingSession.findMany(
            {
              where: {
                userId,
                createdAt: { gte: startDate },
                state: 'finished',
              },
              include: {
                turns: {
                  where: {
                    state: 'completed',
                  },
                  select: {
                    score: true,
                    evaluation: true,
                  },
                },
              },
            },
          );

          // Calculate summary statistics
          const totalStudyTime = this.calculateStudyTime(
            submissions,
            podcastAttempts,
            speakingSessions,
          );
          const lessonsCompleted = await this.countCompletedLessons(
            userId,
            startDate,
          );
          const assignmentsSubmitted = submissions.length;
          const avgScore = this.calculateAverageScore(submissions);
          const studyStreak = await this.calculateStreak(userId);
          const certificatesEarned = await this.countCertificates(userId);

          // Skill breakdown
          const skillBreakdown = {
            vocabulary: this.analyzeVocabulary(vocabProgress),
            grammar: this.analyzeGrammar(submissions),
            listening: this.analyzeListening(podcastAttempts),
            speaking: this.analyzeSpeaking(speakingSessions),
            reading: this.analyzeReading(submissions),
            writing: this.analyzeWriting(submissions),
          };

          // Activity trend (for charts)
          const activityTrend = includeCharts
            ? this.buildActivityTrend(submissions, podcastAttempts, startDate)
            : null;

          // Score progression
          const scoreProgression = includeCharts
            ? this.buildScoreProgression(submissions)
            : null;

          // Predictions
          const prediction = includePrediction
            ? await this.generatePrediction(userId, avgScore, skillBreakdown)
            : null;

          // Recommendations
          const recommendations = this.generateRecommendations(
            skillBreakdown,
            submissions,
          );

          return JSON.stringify({
            success: true,
            summary: {
              totalStudyTime, // minutes
              lessonsCompleted,
              assignmentsSubmitted,
              avgScore: avgScore.toFixed(1),
              studyStreak,
              certificatesEarned,
            },
            skillBreakdown,
            activityTrend,
            scoreProgression,
            prediction,
            recommendations,
            timeRange,
            period: {
              start: startDate.toISOString(),
              end: now.toISOString(),
            },
          });
        } catch (error) {
          this.logger.error('Learning analytics error:', error);
          return JSON.stringify({
            success: false,
            error: 'Lỗi tạo thống kê học tập',
            message: 'Vui lòng thử lại sau',
          });
        }
      },
    });
  }

  // Helper methods for learning analytics

  private getStartDate(now: Date, range: string): Date {
    const start = new Date(now);
    switch (range) {
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'all-time':
        start.setFullYear(2020); // Very old date
        break;
    }
    return start;
  }

  private calculateStudyTime(
    submissions: any[],
    podcastAttempts: any[],
    speakingSessions: any[],
  ): number {
    let totalMinutes = 0;

    // From submissions (timeSpent field if available)
    submissions.forEach((s) => {
      if (s.timeSpent) {
        totalMinutes += s.timeSpent;
      }
    });

    // From podcast attempts
    podcastAttempts.forEach((p) => {
      if (p.timeSpent) {
        totalMinutes += p.timeSpent;
      }
    });

    // From speaking sessions (estimate 5 minutes per session)
    totalMinutes += speakingSessions.length * 5;

    return Math.round(totalMinutes);
  }

  private async countCompletedLessons(
    userId: string,
    startDate: Date,
  ): Promise<number> {
    // Count unique lessons from completed assignments
    const submissions = await this.prisma.assignmentSubmission.findMany({
      where: {
        studentId: userId,
        submittedAt: { gte: startDate },
        score: { not: null },
      },
      select: {
        assignment: {
          select: {
            classroom: {
              select: {
                course: {
                  select: {
                    lessons: {
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const lessonIds = new Set<string>();
    submissions.forEach((s) => {
      s.assignment.classroom.course.lessons.forEach((l) => {
        lessonIds.add(l.id);
      });
    });

    return lessonIds.size;
  }

  private calculateAverageScore(submissions: any[]): number {
    if (submissions.length === 0) return 0;

    const percentages = submissions.map((s) => {
      const total = s.assignment.totalPoints || 100;
      return (s.score / total) * 100;
    });

    return percentages.reduce((a, b) => a + b, 0) / percentages.length;
  }

  private async calculateStreak(userId: string): Promise<number> {
    // Get all submissions ordered by date
    const submissions = await this.prisma.assignmentSubmission.findMany({
      where: { studentId: userId },
      select: { submittedAt: true },
      orderBy: { submittedAt: 'desc' },
    });

    if (submissions.length === 0) return 0;

    // Group by date
    const dates = new Set<string>();
    submissions.forEach((s) => {
      if (s.submittedAt) {
        const date = new Date(s.submittedAt).toDateString();
        dates.add(date);
      }
    });

    // Calculate consecutive days
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

  private async countCertificates(userId: string): Promise<number> {
    return this.prisma.issuedCertificate.count({
      where: { studentId: userId },
    });
  }

  private analyzeVocabulary(progress: any[]) {
    const mastered = progress.filter(
      (p) => p.masteryLevel === 'mastered',
    ).length;
    const total = progress.length;
    const masteryRate = total > 0 ? (mastered / total) * 100 : 0;

    // Group by difficulty
    const byDifficulty = new Map<string, number>();
    progress.forEach((p) => {
      const diff = p.term?.unit?.list?.difficulty || 'unknown';
      byDifficulty.set(diff, (byDifficulty.get(diff) || 0) + 1);
    });

    return {
      wordsLearned: total,
      masteryRate: Math.round(masteryRate),
      weakTopics: [], // Could analyze by category
      strongTopics: [],
    };
  }

  private analyzeGrammar(submissions: any[]) {
    // Filter grammar-related assignments
    const grammarSubs = submissions.filter((s) =>
      s.assignment.title.toLowerCase().includes('grammar'),
    );

    if (grammarSubs.length === 0) {
      return {
        topicsCompleted: 0,
        masteryRate: 0,
        weakTopics: [],
        strongTopics: [],
      };
    }

    const percentages = grammarSubs.map((s) => {
      const total = s.assignment.totalPoints || 100;
      return (s.score / total) * 100;
    });

    const avgScore =
      percentages.reduce((a, b) => a + b, 0) / percentages.length;

    return {
      topicsCompleted: grammarSubs.length,
      masteryRate: Math.round(avgScore),
      weakTopics: [],
      strongTopics: [],
    };
  }

  private analyzeListening(podcastAttempts: any[]) {
    if (podcastAttempts.length === 0) {
      return {
        minutesPracticed: 0,
        masteryRate: 0,
        avgAccuracy: 0,
      };
    }

    const totalMinutes = podcastAttempts.reduce(
      (sum, p) => sum + (p.timeSpent || 0),
      0,
    );
    const scores = podcastAttempts
      .map((p) => p.scorePercent)
      .filter((s) => s !== null && s !== undefined);
    const avgAccuracy =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
      minutesPracticed: Math.round(totalMinutes),
      masteryRate: Math.round(avgAccuracy),
      avgAccuracy: Math.round(avgAccuracy),
    };
  }

  private analyzeSpeaking(sessions: any[]) {
    if (sessions.length === 0) {
      return {
        minutesPracticed: 0,
        masteryRate: 0,
        avgPronunciationScore: 0,
      };
    }

    const totalMinutes = sessions.length * 5; // Estimate
    const allScores: number[] = [];

    sessions.forEach((s) => {
      s.turns.forEach((t: any) => {
        if (t.score) allScores.push(t.score);
      });
    });

    const avgScore =
      allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 0;

    return {
      minutesPracticed: totalMinutes,
      masteryRate: Math.round(avgScore), // score is already 0-100
      avgPronunciationScore: Math.round(avgScore),
    };
  }

  private analyzeReading(submissions: any[]) {
    const readingSubs = submissions.filter((s) =>
      s.assignment.title.toLowerCase().includes('reading'),
    );

    return {
      articlesRead: readingSubs.length,
      masteryRate: readingSubs.length > 0 ? 75 : 0, // Placeholder
      readingSpeed: 180, // Placeholder
    };
  }

  private analyzeWriting(submissions: any[]) {
    const writingSubs = submissions.filter(
      (s) =>
        s.assignment.title.toLowerCase().includes('writing') ||
        s.assignment.type === 'ESSAY',
    );

    const avgScore =
      writingSubs.length > 0
        ? writingSubs.reduce((sum, s) => {
            const total = s.assignment.totalPoints || 100;
            return sum + (s.score / total) * 100;
          }, 0) / writingSubs.length
        : 0;

    return {
      essaysWritten: writingSubs.length,
      avgScore: Math.round(avgScore * 10) / 10,
      wordCount: 0, // Would need to track separately
    };
  }

  private buildActivityTrend(
    submissions: any[],
    podcastAttempts: any[],
    startDate: Date,
  ) {
    // Group by date
    const dailyActivity = new Map<string, number>();

    submissions.forEach((s) => {
      if (s.submittedAt) {
        const date = new Date(s.submittedAt).toISOString().split('T')[0];
        dailyActivity.set(date, (dailyActivity.get(date) || 0) + 1);
      }
    });

    podcastAttempts.forEach((p) => {
      if (p.createdAt) {
        const date = new Date(p.createdAt).toISOString().split('T')[0];
        dailyActivity.set(date, (dailyActivity.get(date) || 0) + 1);
      }
    });

    const data = Array.from(dailyActivity.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      type: 'line',
      title: 'Hoạt động học tập',
      data,
    };
  }

  private buildScoreProgression(submissions: any[]) {
    const data = submissions
      .reverse()
      .map((s, idx) => {
        const total = s.assignment.totalPoints || 100;
        const percentage = (s.score / total) * 100;
        return {
          assignment: `Bài ${idx + 1}`,
          score: s.score,
          maxScore: total,
          percentage: Math.round(percentage),
        };
      })
      .slice(-10); // Last 10 assignments

    const trend =
      data.length >= 3
        ? data[data.length - 1].percentage > data[0].percentage
          ? 'improving'
          : 'declining'
        : 'stable';

    return {
      type: 'line',
      title: 'Xu hướng điểm số',
      data,
      trend,
    };
  }

  private async generatePrediction(
    userId: string,
    currentAvgScore: number,
    skillBreakdown: any,
  ) {
    // Simple prediction based on current performance
    const overallMastery =
      (skillBreakdown.vocabulary.masteryRate +
        skillBreakdown.grammar.masteryRate +
        skillBreakdown.listening.masteryRate +
        skillBreakdown.speaking.masteryRate +
        skillBreakdown.reading.masteryRate +
        skillBreakdown.writing.masteryRate) /
      6;

    // Estimate level based on mastery
    let currentLevel = 'A1';
    if (overallMastery >= 80) currentLevel = 'C1';
    else if (overallMastery >= 70) currentLevel = 'B2';
    else if (overallMastery >= 60) currentLevel = 'B1';
    else if (overallMastery >= 50) currentLevel = 'A2';

    // Predict next level in 30 days if improving
    let projectedLevel = currentLevel;
    if (overallMastery >= 75 && overallMastery < 80) {
      projectedLevel = 'B2';
    } else if (overallMastery >= 65 && overallMastery < 70) {
      projectedLevel = 'B1';
    } else if (overallMastery >= 55 && overallMastery < 60) {
      projectedLevel = 'A2';
    }

    return {
      projectedLevelIn30Days: projectedLevel,
      currentLevel,
      confidence: Math.round(overallMastery),
      basedOn: 'Current performance and mastery rates',
    };
  }

  private generateRecommendations(skillBreakdown: any, submissions: any[]) {
    const recommendations: any[] = [];

    // Check for weak skills
    if (skillBreakdown.grammar.masteryRate < 60) {
      recommendations.push({
        priority: 'high',
        action: 'Tập trung vào Grammar',
        reason: `Điểm grammar hiện tại: ${skillBreakdown.grammar.masteryRate}%`,
        suggestedLessons: [],
      });
    }

    if (skillBreakdown.speaking.masteryRate < 60) {
      recommendations.push({
        priority: 'medium',
        action: 'Tăng thời gian luyện speaking',
        reason: `Điểm speaking hiện tại: ${skillBreakdown.speaking.masteryRate}%`,
        suggestedLessons: [],
      });
    }

    return recommendations;
  }
}
