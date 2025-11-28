import { PrismaRepository } from '@app/database';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * PodcastHistoryTool - Công cụ xem lịch sử nghe podcast và gợi ý
 *
 * Features:
 * - Xem lịch sử podcast đã nghe
 * - Thống kê điểm số, thời gian
 * - Gợi ý podcast phù hợp
 * - Tracking tiến độ theo category/difficulty
 */
@Injectable()
export class PodcastHistoryTool {
  private readonly logger = new Logger(PodcastHistoryTool.name);

  constructor(private readonly prisma: PrismaRepository) {}

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_podcast_history',
      description: `Xem lịch sử nghe podcast và gợi ý podcast phù hợp. Sử dụng khi:
- "podcast đã nghe", "lịch sử podcast"
- "gợi ý podcast", "podcast nào hay"
- "điểm podcast của tôi", "tiến độ listening"
- "podcast nào chưa làm", "podcast tiếp theo"
Trả về lịch sử, thống kê và gợi ý podcast.`,
      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
        action: z
          .enum(['history', 'stats', 'recommend', 'all'])
          .optional()
          .default('all')
          .describe('Loại thông tin cần lấy'),
        category: z
          .string()
          .optional()
          .describe('Lọc theo category (optional)'),
        difficulty: z
          .enum(['beginner', 'intermediate', 'advanced', 'all'])
          .optional()
          .default('all')
          .describe('Lọc theo độ khó'),
        limit: z.number().optional().default(10).describe('Số lượng kết quả'),
      }),
      func: async ({
        userId,
        action = 'all',
        category,
        difficulty = 'all',
        limit = 10,
      }) => {
        try {
          this.logger.log(`Getting podcast history for user: ${userId}`);

          const result: any = { success: true };

          // 1. Get history
          if (action === 'history' || action === 'all') {
            const attempts = await this.prisma.podcastAttempt.findMany({
              where: {
                userId,
                status: 'submitted',
              },
              include: {
                podcast: {
                  select: {
                    id: true,
                    title: true,
                    category: true,
                    difficulty: true,
                    duration: true,
                    thumbnailUrl: true,
                    averageRating: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: limit,
            });

            result.history = attempts.map((a) => ({
              attemptId: a.id,
              podcastId: a.podcastId,
              title: a.podcast.title,
              category: a.podcast.category,
              difficulty: a.podcast.difficulty,
              score: a.scorePercent,
              correctCount: a.correctCount,
              totalQuestions: a.totalQuestions,
              timeSpent: a.timeSpent,
              attemptNo: a.attemptNo,
              completedAt: a.createdAt,
              rating: a.podcast.averageRating,
            }));

            result.historyCount = attempts.length;
          }

          // 2. Get stats
          if (action === 'stats' || action === 'all') {
            const allAttempts = await this.prisma.podcastAttempt.findMany({
              where: { userId, status: 'submitted' },
              include: {
                podcast: {
                  select: { category: true, difficulty: true, duration: true },
                },
              },
            });

            // Overall stats
            const totalAttempts = allAttempts.length;
            const avgScore =
              totalAttempts > 0
                ? allAttempts.reduce((sum, a) => sum + a.scorePercent, 0) /
                  totalAttempts
                : 0;
            const totalTimeSpent = allAttempts.reduce(
              (sum, a) => sum + (a.timeSpent || 0),
              0,
            );
            const totalListeningTime = allAttempts.reduce(
              (sum, a) => sum + (a.podcast.duration || 0),
              0,
            );

            // Unique podcasts
            const uniquePodcasts = new Set(allAttempts.map((a) => a.podcastId))
              .size;

            // By category
            const byCategory: Record<
              string,
              { count: number; avgScore: number }
            > = {};
            allAttempts.forEach((a) => {
              const cat = a.podcast.category || 'other';
              if (!byCategory[cat]) {
                byCategory[cat] = { count: 0, avgScore: 0 };
              }
              byCategory[cat].count++;
              byCategory[cat].avgScore =
                (byCategory[cat].avgScore * (byCategory[cat].count - 1) +
                  a.scorePercent) /
                byCategory[cat].count;
            });

            // By difficulty
            const byDifficulty: Record<
              string,
              { count: number; avgScore: number }
            > = {};
            allAttempts.forEach((a) => {
              const diff = a.podcast.difficulty || 'intermediate';
              if (!byDifficulty[diff]) {
                byDifficulty[diff] = { count: 0, avgScore: 0 };
              }
              byDifficulty[diff].count++;
              byDifficulty[diff].avgScore =
                (byDifficulty[diff].avgScore * (byDifficulty[diff].count - 1) +
                  a.scorePercent) /
                byDifficulty[diff].count;
            });

            // Best/worst scores
            const sortedByScore = [...allAttempts].sort(
              (a, b) => b.scorePercent - a.scorePercent,
            );
            const bestScores = sortedByScore.slice(0, 3);
            const worstScores = sortedByScore.slice(-3).reverse();

            result.stats = {
              totalAttempts,
              uniquePodcasts,
              avgScore: Math.round(avgScore * 10) / 10,
              totalTimeSpent: Math.round(totalTimeSpent / 60), // minutes
              totalListeningTime: Math.round(totalListeningTime / 60), // minutes
              byCategory: Object.entries(byCategory).map(([cat, data]) => ({
                category: cat,
                count: data.count,
                avgScore: Math.round(data.avgScore * 10) / 10,
              })),
              byDifficulty: Object.entries(byDifficulty).map(([diff, data]) => ({
                difficulty: diff,
                count: data.count,
                avgScore: Math.round(data.avgScore * 10) / 10,
              })),
              bestScores: bestScores.map((a) => ({
                podcastId: a.podcastId,
                score: a.scorePercent,
              })),
              worstScores: worstScores.map((a) => ({
                podcastId: a.podcastId,
                score: a.scorePercent,
              })),
            };
          }

          // 3. Get recommendations
          if (action === 'recommend' || action === 'all') {
            // Get podcasts user hasn't attempted
            const attemptedPodcastIds = (
              await this.prisma.podcastAttempt.findMany({
                where: { userId },
                select: { podcastId: true },
                distinct: ['podcastId'],
              })
            ).map((a) => a.podcastId);

            const whereClause: any = {
              id: { notIn: attemptedPodcastIds },
            };
            if (category) {
              whereClause.category = category;
            }
            if (difficulty !== 'all') {
              whereClause.difficulty = difficulty;
            }

            const recommendations = await this.prisma.podcast.findMany({
              where: whereClause,
              select: {
                id: true,
                title: true,
                description: true,
                category: true,
                difficulty: true,
                duration: true,
                thumbnailUrl: true,
                averageRating: true,
                viewCount: true,
              },
              orderBy: [{ averageRating: 'desc' }, { viewCount: 'desc' }],
              take: limit,
            });

            result.recommendations = recommendations.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description?.substring(0, 100) + '...',
              category: p.category,
              difficulty: p.difficulty,
              duration: Math.round(p.duration / 60), // minutes
              rating: p.averageRating,
              views: p.viewCount,
              reason: this.getRecommendationReason(p),
            }));

            result.recommendationCount = recommendations.length;
          }

          // Generate summary message
          if (action === 'all') {
            const historyCount = result.historyCount || 0;
            const avgScore = result.stats?.avgScore || 0;
            const recCount = result.recommendationCount || 0;

            if (historyCount === 0) {
              result.message =
                '🎧 Bạn chưa nghe podcast nào. Hãy thử những gợi ý bên dưới!';
            } else if (avgScore >= 80) {
              result.message = `🌟 Xuất sắc! Đã hoàn thành ${historyCount} podcast với điểm TB ${avgScore}%. Còn ${recCount} podcast mới chờ bạn!`;
            } else if (avgScore >= 60) {
              result.message = `👍 Tốt lắm! ${historyCount} podcast, điểm TB ${avgScore}%. Tiếp tục cố gắng!`;
            } else {
              result.message = `💪 Đã thử ${historyCount} podcast. Hãy nghe lại để cải thiện điểm số!`;
            }
          }

          return JSON.stringify(result);
        } catch (error) {
          this.logger.error('Error getting podcast history:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể lấy lịch sử podcast. Vui lòng thử lại.',
          });
        }
      },
    });
  }

  private getRecommendationReason(podcast: any): string {
    if (podcast.averageRating >= 4.5) return '⭐ Được đánh giá cao';
    if (podcast.viewCount >= 100) return 'Phổ biến';
    if (podcast.difficulty === 'beginner') return 'Phù hợp người mới';
    if (podcast.difficulty === 'advanced') return 'Thử thách bản thân';
    return '✨ Gợi ý cho bạn';
  }
}
