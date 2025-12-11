import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { AiSpeakingSessionState } from '@prisma/client';
import { z } from 'zod';

/**
 * Speaking Progress Tool
 *
 * Provides comprehensive analytics for AI Speaking practice sessions.
 * Tracks pronunciation scores, fluency, conversation skills, and improvement trends.
 */
@Injectable()
export class SpeakingProgressTool {
  private readonly logger = new Logger(SpeakingProgressTool.name);

  constructor(
    private prisma: PrismaRepository,
    private gemini: GeminiService,
  ) {}

  /**
   * Returns array of speaking progress tools
   */
  getTools(): DynamicStructuredTool[] {
    return [
      this.getSpeakingOverviewTool(),
      this.getSessionDetailTool(),
      this.getSpeakingTrendsTool(),
      this.getPronunciationAnalysisTool(),
    ];
  }

  /**
   * Tool 1: Get speaking practice overview
   * Summary of all speaking sessions and performance
   */
  private getSpeakingOverviewTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'speaking_overview',
      description: `Tong quan luyen noi AI cua hoc sinh - so phien, diem trung binh, xu huong.

Su dung tool nay khi:
- Hoc sinh hoi "tien do luyen noi cua toi"
- Hoc sinh hoi "toi da luyen speaking bao nhieu"
- Nguoi dung muon xem thong ke luyen noi tong the
- Phu huynh hoi ve tinh hinh luyen noi cua con

Ket qua tra ve:
- Tong so phien luyen tap
- Diem trung binh (pronunciation, fluency)
- So luot hoi thoai (turns)
- Thong ke theo thoi gian
- Bieu do tien trinh
- Goi y cai thien`,
      schema: z.object({
        studentId: z
          .string()
          .optional()
          .describe('UUID cua hoc sinh (tu dong lay neu la student)'),
        period: z
          .enum(['week', 'month', 'quarter', 'all'])
          .optional()
          .default('month'),
        includeCharts: z.boolean().optional().default(true),
      }),
      func: async ({ studentId, period = 'month', includeCharts = true }) => {
        try {
          this.logger.log(
            `Speaking overview: studentId=${studentId}, period=${period}`,
          );

          if (!studentId) {
            return JSON.stringify({
              success: false,
              error: 'Vui long cung cap studentId',
            });
          }

          const startDate = this.getStartDate(period);

          // Get all speaking sessions
          const sessions = await this.prisma.aiSpeakingSession.findMany({
            where: {
              userId: studentId,
              createdAt: { gte: startDate },
            },
            include: {
              turns: {
                select: {
                  id: true,
                  score: true,
                  relevanceScore: true,
                  userDurationSec: true,
                  pronunciationFeedback: true,
                  evaluation: true,
                  metrics: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          });

          // Calculate overall stats
          const totalSessions = sessions.length;
          const completedSessions = sessions.filter(
            (s) => s.state === AiSpeakingSessionState.finished,
          ).length;
          const totalTurns = sessions.reduce((sum, s) => sum + s.turnCount, 0);
          const totalDuration = sessions.reduce((sum, s) => {
            const turnDuration = s.turns.reduce(
              (t, turn) => t + (turn.userDurationSec || 0),
              0,
            );
            return sum + turnDuration;
          }, 0);

          // Calculate scores from turns
          const allTurns = sessions.flatMap((s) => s.turns);
          const turnsWithScores = allTurns.filter((t) => t.score !== null);

          const avgScore =
            turnsWithScores.length > 0
              ? Math.round(
                  turnsWithScores.reduce((sum, t) => sum + (t.score || 0), 0) /
                    turnsWithScores.length,
                )
              : 0;

          const avgRelevance =
            turnsWithScores.length > 0
              ? Math.round(
                  (turnsWithScores.reduce(
                    (sum, t) => sum + (t.relevanceScore || 0),
                    0,
                  ) /
                    turnsWithScores.length) *
                    100,
                ) / 100
              : 0;

          // Extract pronunciation metrics from feedback
          const pronunciationData = this.extractPronunciationMetrics(allTurns);

          // Group by date for trend
          const dailyStats = new Map<
            string,
            {
              date: string;
              sessions: number;
              turns: number;
              avgScore: number;
              scores: number[];
            }
          >();

          sessions.forEach((session) => {
            const dateKey = session.createdAt.toISOString().split('T')[0];
            if (!dailyStats.has(dateKey)) {
              dailyStats.set(dateKey, {
                date: dateKey,
                sessions: 0,
                turns: 0,
                avgScore: 0,
                scores: [],
              });
            }
            const daily = dailyStats.get(dateKey)!;
            daily.sessions++;
            daily.turns += session.turnCount;
            session.turns.forEach((t) => {
              if (t.score !== null) daily.scores.push(t.score);
            });
          });

          // Calculate daily averages
          const dailyTrend = Array.from(dailyStats.values())
            .map((d) => ({
              date: d.date,
              sessions: d.sessions,
              turns: d.turns,
              avgScore:
                d.scores.length > 0
                  ? Math.round(
                      d.scores.reduce((a, b) => a + b, 0) / d.scores.length,
                    )
                  : 0,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

          // Topic distribution
          const topicCounts = new Map<string, number>();
          sessions.forEach((s) => {
            const topic = s.topic || 'General';
            topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
          });
          const topTopics = Array.from(topicCounts.entries())
            .map(([topic, count]) => ({ topic, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          // Difficulty distribution
          const difficultyStats = {
            beginner: sessions.filter((s) => s.targetDifficulty === 'beginner')
              .length,
            intermediate: sessions.filter(
              (s) => s.targetDifficulty === 'intermediate',
            ).length,
            advanced: sessions.filter((s) => s.targetDifficulty === 'advanced')
              .length,
          };

          // Generate charts
          const charts: any[] = [];
          if (includeCharts && dailyTrend.length > 0) {
            // Chart 1: Score trend over time
            charts.push({
              type: 'chart',
              chartType: 'line',
              title: 'Xu huong diem luyen noi',
              data: dailyTrend.slice(-14).map((d) => ({
                name: new Date(d.date).toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                }),
                value: d.avgScore,
              })),
              config: {
                xLabel: 'Ngay',
                yLabel: 'Diem TB',
                colors: ['#10b981'],
              },
            });

            // Chart 2: Sessions per day
            charts.push({
              type: 'chart',
              chartType: 'bar',
              title: 'So phien luyen tap theo ngay',
              data: dailyTrend.slice(-14).map((d) => ({
                name: new Date(d.date).toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                }),
                value: d.sessions,
              })),
              config: {
                xLabel: 'Ngay',
                yLabel: 'So phien',
                colors: ['#3b82f6'],
              },
            });

            // Chart 3: Topic distribution
            if (topTopics.length > 0) {
              charts.push({
                type: 'chart',
                chartType: 'pie',
                title: 'Phan bo chu de luyen tap',
                data: topTopics.map((t) => ({
                  name: t.topic.substring(0, 15),
                  value: t.count,
                })),
                config: {
                  colors: [
                    '#3b82f6',
                    '#10b981',
                    '#f59e0b',
                    '#ef4444',
                    '#8b5cf6',
                  ],
                  legend: true,
                },
              });
            }

            // Chart 4: Pronunciation breakdown
            if (pronunciationData.avgAccuracy > 0) {
              charts.push({
                type: 'chart',
                chartType: 'radar',
                title: 'Chi so phat am',
                data: [
                  { name: 'Accuracy', value: pronunciationData.avgAccuracy },
                  { name: 'Fluency', value: pronunciationData.avgFluency },
                  {
                    name: 'Completeness',
                    value: pronunciationData.avgCompleteness,
                  },
                  {
                    name: 'Pronunciation',
                    value: pronunciationData.avgPronunciation,
                  },
                ],
                config: {
                  colors: ['#8b5cf6'],
                  legend: false,
                },
              });
            }
          }

          // Generate AI recommendations
          const recommendations = await this.generateSpeakingRecommendations({
            totalSessions,
            completedSessions,
            avgScore,
            pronunciationData,
            topTopics,
          });

          return JSON.stringify({
            success: true,
            overview: {
              totalSessions,
              completedSessions,
              completionRate:
                totalSessions > 0
                  ? Math.round((completedSessions / totalSessions) * 100)
                  : 0,
              totalTurns,
              totalDurationMinutes: Math.round(totalDuration / 60),
              avgScore,
              avgRelevance,
            },
            pronunciation: pronunciationData,
            difficultyDistribution: difficultyStats,
            topTopics,
            dailyTrend: dailyTrend.slice(-30),
            charts,
            recommendations,
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Speaking overview error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: `Loi lay thong ke: ${error.message}`,
          });
        }
      },
    });
  }

  /**
   * Tool 2: Get detailed session information
   * Analyzes a specific speaking session
   */
  private getSessionDetailTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'speaking_session_detail',
      description: `Chi tiet mot phien luyen noi cu the - tung luot hoi thoai, diem, feedback.

Su dung tool nay khi:
- Hoc sinh hoi "phien luyen noi gan nhat cua toi"
- Hoc sinh hoi "chi tiet bai noi hom qua"
- Nguoi dung muon xem feedback cu the cua mot phien

Ket qua tra ve:
- Thong tin phien (topic, goal, difficulty)
- Chi tiet tung turn (AI prompt, user response, score)
- Feedback phat am
- Phan tich AI`,
      schema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe('UUID cua phien (lay phien gan nhat neu khong co)'),
        studentId: z
          .string()
          .optional()
          .describe('UUID hoc sinh (de lay phien gan nhat)'),
      }),
      func: async ({ sessionId, studentId }) => {
        try {
          this.logger.log(
            `Session detail: sessionId=${sessionId}, studentId=${studentId}`,
          );

          let session: any;

          if (sessionId) {
            session = await this.prisma.aiSpeakingSession.findUnique({
              where: { id: sessionId },
              include: {
                turns: {
                  orderBy: { turnIndex: 'asc' },
                  include: {
                    segments: {
                      orderBy: { orderNo: 'asc' },
                    },
                  },
                },
                user: {
                  select: { id: true, displayName: true, email: true },
                },
              },
            });
          } else if (studentId) {
            session = await this.prisma.aiSpeakingSession.findFirst({
              where: { userId: studentId },
              orderBy: { createdAt: 'desc' },
              include: {
                turns: {
                  orderBy: { turnIndex: 'asc' },
                  include: {
                    segments: {
                      orderBy: { orderNo: 'asc' },
                    },
                  },
                },
                user: {
                  select: { id: true, displayName: true, email: true },
                },
              },
            });
          }

          if (!session) {
            return JSON.stringify({
              success: false,
              error: 'Khong tim thay phien luyen noi',
            });
          }

          // Process turns
          const turnsDetail = session.turns.map((turn: any) => {
            const pronunciationFb = turn.pronunciationFeedback as any;
            const evaluation = turn.evaluation as any;
            const metrics = turn.metrics as any;

            return {
              turnIndex: turn.turnIndex,
              state: turn.state,
              aiPrompt: turn.aiPrompt,
              userTranscript: turn.userTranscript,
              userDurationSec: turn.userDurationSec,
              score: turn.score,
              relevanceScore: turn.relevanceScore,
              silenceDetected: turn.silenceDetected,
              suggestions: turn.suggestions,
              pronunciation: pronunciationFb
                ? {
                    accuracyScore:
                      pronunciationFb.NBest?.[0]?.PronunciationAssessment
                        ?.AccuracyScore,
                    fluencyScore:
                      pronunciationFb.NBest?.[0]?.PronunciationAssessment
                        ?.FluencyScore,
                    completenessScore:
                      pronunciationFb.NBest?.[0]?.PronunciationAssessment
                        ?.CompletenessScore,
                    pronScore:
                      pronunciationFb.NBest?.[0]?.PronunciationAssessment
                        ?.PronScore,
                  }
                : null,
              evaluation: evaluation
                ? {
                    feedback: evaluation.feedback,
                    strengths: evaluation.strengths,
                    improvements: evaluation.improvements,
                  }
                : null,
              metrics,
            };
          });

          // Calculate session-level stats
          const turnsWithScores = turnsDetail.filter(
            (t: any) => t.score !== null,
          );
          const avgScore =
            turnsWithScores.length > 0
              ? Math.round(
                  turnsWithScores.reduce(
                    (sum: number, t: any) => sum + t.score,
                    0,
                  ) / turnsWithScores.length,
                )
              : 0;

          const pronunciationScores = turnsDetail
            .filter((t: any) => t.pronunciation?.accuracyScore)
            .map((t: any) => t.pronunciation);

          const avgPronunciation =
            pronunciationScores.length > 0
              ? {
                  accuracy: Math.round(
                    pronunciationScores.reduce(
                      (sum: number, p: any) => sum + p.accuracyScore,
                      0,
                    ) / pronunciationScores.length,
                  ),
                  fluency: Math.round(
                    pronunciationScores.reduce(
                      (sum: number, p: any) => sum + p.fluencyScore,
                      0,
                    ) / pronunciationScores.length,
                  ),
                  completeness: Math.round(
                    pronunciationScores.reduce(
                      (sum: number, p: any) => sum + p.completenessScore,
                      0,
                    ) / pronunciationScores.length,
                  ),
                  pronunciation: Math.round(
                    pronunciationScores.reduce(
                      (sum: number, p: any) => sum + p.pronScore,
                      0,
                    ) / pronunciationScores.length,
                  ),
                }
              : null;

          // Session duration
          const startTime = session.startedAt || session.createdAt;
          const endTime = session.endedAt || session.updatedAt;
          const durationMinutes = Math.round(
            (new Date(endTime).getTime() - new Date(startTime).getTime()) /
              60000,
          );

          return JSON.stringify({
            success: true,
            session: {
              id: session.id,
              conversationId: session.conversationId,
              topic: session.topic,
              goal: session.goal,
              state: session.state,
              targetDifficulty: session.targetDifficulty,
              currentDifficulty: session.currentDifficulty,
              turnCount: session.turnCount,
              maxTurns: session.maxTurns,
              silenceWarnings: session.silenceWarnings,
              offTopicWarnings: session.offTopicWarnings,
              summary: session.summary,
              startedAt: session.startedAt,
              endedAt: session.endedAt,
              durationMinutes,
            },
            student: session.user,
            performance: {
              avgScore,
              avgPronunciation,
              turnsCompleted: turnsDetail.filter((t: any) => t.userTranscript)
                .length,
              silenceCount: turnsDetail.filter((t: any) => t.silenceDetected)
                .length,
            },
            turns: turnsDetail,
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Session detail error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: `Loi lay chi tiet: ${error.message}`,
          });
        }
      },
    });
  }

  /**
   * Tool 3: Get speaking trends and comparison
   * Analyzes improvement over time
   */
  private getSpeakingTrendsTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'speaking_trends',
      description: `Phan tich xu huong tien bo luyen noi theo thoi gian.

Su dung tool nay khi:
- Hoc sinh hoi "toi tien bo the nao trong speaking"
- Hoc sinh hoi "so sanh ket qua luyen noi thang nay va thang truoc"
- Nguoi dung muon xem improvement trend

Ket qua tra ve:
- So sanh diem giua cac giai doan
- Xu huong cai thien/giam sut
- Bieu do so sanh
- Phan tich AI ve tien trinh`,
      schema: z.object({
        studentId: z.string().describe('UUID cua hoc sinh'),
        compareType: z
          .enum(['week_over_week', 'month_over_month'])
          .optional()
          .default('week_over_week'),
        includeCharts: z.boolean().optional().default(true),
      }),
      func: async ({
        studentId,
        compareType = 'week_over_week',
        includeCharts = true,
      }) => {
        try {
          this.logger.log(
            `Speaking trends: studentId=${studentId}, compareType=${compareType}`,
          );

          const now = new Date();
          let currentPeriodStart: Date;
          let previousPeriodStart: Date;
          let previousPeriodEnd: Date;

          if (compareType === 'week_over_week') {
            currentPeriodStart = new Date(now);
            currentPeriodStart.setDate(currentPeriodStart.getDate() - 7);
            previousPeriodEnd = new Date(currentPeriodStart);
            previousPeriodStart = new Date(previousPeriodEnd);
            previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
          } else {
            currentPeriodStart = new Date(now);
            currentPeriodStart.setMonth(currentPeriodStart.getMonth() - 1);
            previousPeriodEnd = new Date(currentPeriodStart);
            previousPeriodStart = new Date(previousPeriodEnd);
            previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
          }

          // Get current period sessions
          const currentSessions = await this.prisma.aiSpeakingSession.findMany({
            where: {
              userId: studentId,
              createdAt: { gte: currentPeriodStart },
            },
            include: {
              turns: {
                select: {
                  score: true,
                  pronunciationFeedback: true,
                  relevanceScore: true,
                },
              },
            },
          });

          // Get previous period sessions
          const previousSessions = await this.prisma.aiSpeakingSession.findMany(
            {
              where: {
                userId: studentId,
                createdAt: {
                  gte: previousPeriodStart,
                  lt: previousPeriodEnd,
                },
              },
              include: {
                turns: {
                  select: {
                    score: true,
                    pronunciationFeedback: true,
                    relevanceScore: true,
                  },
                },
              },
            },
          );

          // Calculate stats for each period
          const currentStats = this.calculatePeriodStats(currentSessions);
          const previousStats = this.calculatePeriodStats(previousSessions);

          // Calculate changes
          const changes = {
            sessions: currentStats.totalSessions - previousStats.totalSessions,
            turns: currentStats.totalTurns - previousStats.totalTurns,
            avgScore: currentStats.avgScore - previousStats.avgScore,
            avgPronunciation:
              currentStats.pronunciation.avgPronunciation -
              previousStats.pronunciation.avgPronunciation,
            avgFluency:
              currentStats.pronunciation.avgFluency -
              previousStats.pronunciation.avgFluency,
          };

          // Determine trend
          const scoreTrend =
            changes.avgScore > 5
              ? 'improving'
              : changes.avgScore < -5
                ? 'declining'
                : 'stable';
          const activityTrend =
            changes.sessions > 0
              ? 'increasing'
              : changes.sessions < 0
                ? 'decreasing'
                : 'stable';

          // Generate charts
          const charts: any[] = [];
          if (includeCharts) {
            // Chart 1: Comparison bar chart
            charts.push({
              type: 'chart',
              chartType: 'bar',
              title: `So sanh ${compareType === 'week_over_week' ? 'tuan' : 'thang'}`,
              data: [
                { name: 'Truoc', value: previousStats.avgScore },
                { name: 'Hien tai', value: currentStats.avgScore },
              ],
              config: {
                xLabel: 'Giai doan',
                yLabel: 'Diem TB',
                colors: ['#94a3b8', '#10b981'],
              },
            });

            // Chart 2: Pronunciation comparison
            if (
              currentStats.pronunciation.avgAccuracy > 0 ||
              previousStats.pronunciation.avgAccuracy > 0
            ) {
              charts.push({
                type: 'chart',
                chartType: 'bar',
                title: 'So sanh phat am',
                data: [
                  {
                    name: 'Accuracy (truoc)',
                    value: previousStats.pronunciation.avgAccuracy,
                  },
                  {
                    name: 'Accuracy (nay)',
                    value: currentStats.pronunciation.avgAccuracy,
                  },
                  {
                    name: 'Fluency (truoc)',
                    value: previousStats.pronunciation.avgFluency,
                  },
                  {
                    name: 'Fluency (nay)',
                    value: currentStats.pronunciation.avgFluency,
                  },
                ],
                config: {
                  xLabel: 'Chi so',
                  yLabel: 'Diem',
                  colors: ['#94a3b8', '#10b981', '#94a3b8', '#10b981'],
                },
              });
            }

            // Chart 3: Activity comparison
            charts.push({
              type: 'chart',
              chartType: 'bar',
              title: 'So sanh hoat dong',
              data: [
                { name: 'Phien (truoc)', value: previousStats.totalSessions },
                { name: 'Phien (nay)', value: currentStats.totalSessions },
                { name: 'Turns (truoc)', value: previousStats.totalTurns },
                { name: 'Turns (nay)', value: currentStats.totalTurns },
              ],
              config: {
                xLabel: 'Chi so',
                yLabel: 'So luong',
                colors: ['#94a3b8', '#3b82f6', '#94a3b8', '#3b82f6'],
              },
            });
          }

          // Generate AI analysis
          const aiAnalysis = await this.analyzeTrends({
            currentStats,
            previousStats,
            changes,
            scoreTrend,
            activityTrend,
          });

          return JSON.stringify({
            success: true,
            comparison: {
              type: compareType,
              currentPeriod: {
                from: currentPeriodStart.toISOString().split('T')[0],
                to: now.toISOString().split('T')[0],
                stats: currentStats,
              },
              previousPeriod: {
                from: previousPeriodStart.toISOString().split('T')[0],
                to: previousPeriodEnd.toISOString().split('T')[0],
                stats: previousStats,
              },
            },
            changes,
            trends: {
              score: scoreTrend,
              activity: activityTrend,
            },
            aiAnalysis,
            charts,
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Speaking trends error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: `Loi phan tich xu huong: ${error.message}`,
          });
        }
      },
    });
  }

  /**
   * Tool 4: Pronunciation analysis
   * Deep dive into pronunciation scores and problem areas
   */
  private getPronunciationAnalysisTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'pronunciation_analysis',
      description: `Phan tich chi tiet ky nang phat am - diem manh, diem yeu, loi thuong gap.

Su dung tool nay khi:
- Hoc sinh hoi "phat am cua toi the nao"
- Hoc sinh hoi "toi phat am sai tu nao nhieu"
- Nguoi dung muon biet can cai thien phat am gi

Ket qua tra ve:
- Diem phat am trung binh (accuracy, fluency, completeness)
- Cac tu/am thuong gap loi
- Goi y luyen tap
- Bieu do radar`,
      schema: z.object({
        studentId: z.string().describe('UUID cua hoc sinh'),
        limit: z
          .number()
          .optional()
          .default(50)
          .describe('So phien gan nhat de phan tich'),
      }),
      func: async ({ studentId, limit = 50 }) => {
        try {
          this.logger.log(`Pronunciation analysis: studentId=${studentId}`);

          // Get recent sessions with pronunciation data
          const sessions = await this.prisma.aiSpeakingSession.findMany({
            where: {
              userId: studentId,
              state: AiSpeakingSessionState.finished,
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
              turns: {
                select: {
                  pronunciationFeedback: true,
                  userTranscript: true,
                  score: true,
                },
              },
            },
          });

          if (sessions.length === 0) {
            return JSON.stringify({
              success: false,
              error: 'Chua co du lieu luyen noi de phan tich',
            });
          }

          // Extract all pronunciation feedback
          const allFeedback: any[] = [];
          const wordErrors: Map<
            string,
            { count: number; avgScore: number; scores: number[] }
          > = new Map();

          sessions.forEach((session) => {
            session.turns.forEach((turn) => {
              const feedback = turn.pronunciationFeedback as any;
              if (feedback?.NBest?.[0]) {
                const assessment = feedback.NBest[0].PronunciationAssessment;
                allFeedback.push({
                  accuracy: assessment?.AccuracyScore || 0,
                  fluency: assessment?.FluencyScore || 0,
                  completeness: assessment?.CompletenessScore || 0,
                  pronunciation: assessment?.PronScore || 0,
                });

                // Extract word-level errors
                const words = feedback.NBest[0].Words || [];
                words.forEach((word: any) => {
                  if (word.PronunciationAssessment?.AccuracyScore < 70) {
                    const wordText = word.Word.toLowerCase();
                    const existing = wordErrors.get(wordText) || {
                      count: 0,
                      avgScore: 0,
                      scores: [],
                    };
                    existing.count++;
                    existing.scores.push(
                      word.PronunciationAssessment.AccuracyScore,
                    );
                    wordErrors.set(wordText, existing);
                  }
                });
              }
            });
          });

          // Calculate averages
          const avgScores =
            allFeedback.length > 0
              ? {
                  accuracy: Math.round(
                    allFeedback.reduce((s, f) => s + f.accuracy, 0) /
                      allFeedback.length,
                  ),
                  fluency: Math.round(
                    allFeedback.reduce((s, f) => s + f.fluency, 0) /
                      allFeedback.length,
                  ),
                  completeness: Math.round(
                    allFeedback.reduce((s, f) => s + f.completeness, 0) /
                      allFeedback.length,
                  ),
                  pronunciation: Math.round(
                    allFeedback.reduce((s, f) => s + f.pronunciation, 0) /
                      allFeedback.length,
                  ),
                }
              : { accuracy: 0, fluency: 0, completeness: 0, pronunciation: 0 };

          // Get top problem words
          const problemWords = Array.from(wordErrors.entries())
            .map(([word, data]) => ({
              word,
              errorCount: data.count,
              avgScore: Math.round(
                data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
              ),
            }))
            .sort((a, b) => b.errorCount - a.errorCount)
            .slice(0, 10);

          // Identify strengths and weaknesses
          const sortedMetrics = Object.entries(avgScores).sort(
            ([, a], [, b]) => b - a,
          );
          const strengths = sortedMetrics.slice(0, 2).map(([metric]) => metric);
          const weaknesses = sortedMetrics.slice(-2).map(([metric]) => metric);

          // Generate recommendations
          const recommendations = this.generatePronunciationRecommendations(
            avgScores,
            problemWords,
          );

          // Generate chart
          const charts = [
            {
              type: 'chart',
              chartType: 'radar',
              title: 'Chi so phat am tong hop',
              data: [
                { name: 'Accuracy', value: avgScores.accuracy },
                { name: 'Fluency', value: avgScores.fluency },
                { name: 'Completeness', value: avgScores.completeness },
                { name: 'Pronunciation', value: avgScores.pronunciation },
              ],
              config: {
                colors: ['#8b5cf6'],
                legend: false,
              },
            },
          ];

          // Add problem words chart if any
          if (problemWords.length > 0) {
            charts.push({
              type: 'chart',
              chartType: 'bar',
              title: 'Tu hay phat am sai',
              data: problemWords.slice(0, 8).map((w) => ({
                name: w.word,
                value: w.errorCount,
              })),
              config: {
                xLabel: 'Tu',
                yLabel: 'So lan sai',
                colors: ['#ef4444'],
              },
            });
          }

          return JSON.stringify({
            success: true,
            sessionsAnalyzed: sessions.length,
            turnsAnalyzed: allFeedback.length,
            overallScores: avgScores,
            level: this.getPronunciationLevel(avgScores.pronunciation),
            strengths,
            weaknesses,
            problemWords,
            recommendations,
            charts,
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Pronunciation analysis error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: `Loi phan tich phat am: ${error.message}`,
          });
        }
      },
    });
  }

  // ==================== HELPER METHODS ====================

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
    }

    return start;
  }

  private extractPronunciationMetrics(turns: any[]) {
    const feedbacks = turns
      .filter((t) => t.pronunciationFeedback)
      .map((t) => {
        const fb = t.pronunciationFeedback as any;
        const assessment = fb?.NBest?.[0]?.PronunciationAssessment;
        return assessment
          ? {
              accuracy: assessment.AccuracyScore || 0,
              fluency: assessment.FluencyScore || 0,
              completeness: assessment.CompletenessScore || 0,
              pronunciation: assessment.PronScore || 0,
            }
          : null;
      })
      .filter(Boolean);

    if (feedbacks.length === 0) {
      return {
        avgAccuracy: 0,
        avgFluency: 0,
        avgCompleteness: 0,
        avgPronunciation: 0,
        count: 0,
      };
    }

    return {
      avgAccuracy: Math.round(
        feedbacks.reduce((s, f: any) => s + f.accuracy, 0) / feedbacks.length,
      ),
      avgFluency: Math.round(
        feedbacks.reduce((s, f: any) => s + f.fluency, 0) / feedbacks.length,
      ),
      avgCompleteness: Math.round(
        feedbacks.reduce((s, f: any) => s + f.completeness, 0) /
          feedbacks.length,
      ),
      avgPronunciation: Math.round(
        feedbacks.reduce((s, f: any) => s + f.pronunciation, 0) /
          feedbacks.length,
      ),
      count: feedbacks.length,
    };
  }

  private calculatePeriodStats(sessions: any[]) {
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(
      (s) => s.state === AiSpeakingSessionState.finished,
    ).length;
    const totalTurns = sessions.reduce(
      (sum, s) => sum + (s.turns?.length || 0),
      0,
    );

    const allTurns = sessions.flatMap((s) => s.turns || []);
    const turnsWithScores = allTurns.filter((t: any) => t.score !== null);

    const avgScore =
      turnsWithScores.length > 0
        ? Math.round(
            turnsWithScores.reduce((sum: number, t: any) => sum + t.score, 0) /
              turnsWithScores.length,
          )
        : 0;

    const pronunciation = this.extractPronunciationMetrics(allTurns);

    return {
      totalSessions,
      completedSessions,
      totalTurns,
      avgScore,
      pronunciation,
    };
  }

  private getPronunciationLevel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 50) return 'Needs Improvement';
    return 'Beginner';
  }

  private generatePronunciationRecommendations(
    scores: {
      accuracy: number;
      fluency: number;
      completeness: number;
      pronunciation: number;
    },
    problemWords: any[],
  ): string[] {
    const recommendations: string[] = [];

    if (scores.accuracy < 70) {
      recommendations.push(
        'Tap trung vao phat am chinh xac tung tu - nghe va lap lai cham',
      );
    }
    if (scores.fluency < 70) {
      recommendations.push(
        'Luyen noi lien mach hon - doc to cac doan van ngan',
      );
    }
    if (scores.completeness < 70) {
      recommendations.push('Co gang noi het cau - khong bo dang giua chung');
    }

    if (problemWords.length > 0) {
      const topProblems = problemWords
        .slice(0, 3)
        .map((w) => w.word)
        .join(', ');
      recommendations.push(`Luyen phat am lai cac tu: ${topProblems}`);
    }

    if (scores.pronunciation >= 80) {
      recommendations.push('Tiep tuc luyen tap de duy tri trinh do tot');
    }

    return recommendations;
  }

  private async generateSpeakingRecommendations(data: {
    totalSessions: number;
    completedSessions: number;
    avgScore: number;
    pronunciationData: any;
    topTopics: any[];
  }): Promise<string[]> {
    const recommendations: string[] = [];

    if (data.totalSessions < 5) {
      recommendations.push('Tang tan suat luyen noi - it nhat 3-5 phien/tuan');
    }

    if (data.completedSessions / data.totalSessions < 0.8) {
      recommendations.push(
        'Co gang hoan thanh het cac phien - dung bo giua chung',
      );
    }

    if (data.avgScore < 60) {
      recommendations.push('Bat dau voi muc do de hon de xay dung tu tin');
    } else if (data.avgScore >= 80) {
      recommendations.push('Thu thach ban than voi cac chu de kho hon');
    }

    if (
      data.pronunciationData.avgFluency < data.pronunciationData.avgAccuracy
    ) {
      recommendations.push(
        'Tap trung vao do luu loat - noi nhanh hon mot chut',
      );
    }

    if (data.topTopics.length < 3) {
      recommendations.push('Mo rong chu de luyen tap de nang cao von tu vung');
    }

    return recommendations;
  }

  private async analyzeTrends(data: {
    currentStats: any;
    previousStats: any;
    changes: any;
    scoreTrend: string;
    activityTrend: string;
  }) {
    const prompt = `Phan tich xu huong luyen noi:

**Giai doan truoc:**
- So phien: ${data.previousStats.totalSessions}
- Diem TB: ${data.previousStats.avgScore}
- Pronunciation: ${data.previousStats.pronunciation.avgPronunciation}

**Giai doan nay:**
- So phien: ${data.currentStats.totalSessions}
- Diem TB: ${data.currentStats.avgScore}
- Pronunciation: ${data.currentStats.pronunciation.avgPronunciation}

**Thay doi:**
- Diem: ${data.changes.avgScore > 0 ? '+' : ''}${data.changes.avgScore}
- Hoat dong: ${data.activityTrend}
- Xu huong diem: ${data.scoreTrend}

Dua ra 2-3 nhan xet ngan ve tien trinh va 1-2 goi y.

Format JSON:
{
  "insights": ["...", "..."],
  "suggestions": ["...", "..."]
}`;

    try {
      const response = await this.gemini.generateResponse(prompt);
      const cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(cleaned);
    } catch {
      return {
        insights: [
          data.scoreTrend === 'improving'
            ? 'Diem so dang cai thien tot'
            : data.scoreTrend === 'declining'
              ? 'Diem so co xu huong giam - can chu y'
              : 'Diem so on dinh',
        ],
        suggestions: ['Tiep tuc luyen tap deu dan'],
      };
    }
  }
}
