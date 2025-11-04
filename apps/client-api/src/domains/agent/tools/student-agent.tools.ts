import { PrismaRepository } from '@app/database';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { RagService } from '../service/rag.service';
import { SqlService } from '../service/sql.service';
import { ChartGeneratorTool } from './chart-generator.tool';
import { RagTool } from './rag.tool';
import { SqlTool } from './sql.tool';

@Injectable()
export class StudentAgentTools {
  private readonly logger = new Logger(StudentAgentTools.name);

  constructor(
    private ragService: RagService,
    private sqlService: SqlService,
    private prisma: PrismaRepository,
    private chartTool: ChartGeneratorTool,
  ) {}

  getTools() {
    return [
      new RagTool(this.ragService),
      new SqlTool(this.sqlService),
      this.chartTool,
      this.getScoreReportTool(),
      this.getAdaptiveRecommendationTool(),
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
}
