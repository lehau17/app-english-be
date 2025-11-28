import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * CompareChildrenTool - Công cụ so sánh tiến độ học tập giữa các con em
 *
 * Features:
 * - So sánh điểm số giữa các con
 * - So sánh tiến độ học tập
 * - So sánh attendance
 * - Highlight điểm mạnh/yếu của từng con
 * - AI recommendations cho từng con
 */
@Injectable()
export class CompareChildrenTool {
  private readonly logger = new Logger(CompareChildrenTool.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly gemini: GeminiService,
  ) {}

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'compare_children_progress',
      description: `So sánh tiến độ học tập giữa các con em của phụ huynh. Sử dụng khi:
- "so sánh tiến độ các con", "con nào học tốt hơn"
- "điểm số các con như thế nào"
- "con nào cần hỗ trợ", "so sánh kết quả học tập"
- "tổng quan học tập các con"
Trả về bảng so sánh chi tiết với biểu đồ và gợi ý.`,
      schema: z.object({
        parentId: z.string().describe('ID của phụ huynh'),
        metric: z
          .enum(['all', 'score', 'attendance', 'progress', 'engagement'])
          .optional()
          .default('all')
          .describe('Tiêu chí so sánh'),
        period: z
          .enum(['7d', '30d', '90d', 'all'])
          .optional()
          .default('30d')
          .describe('Khoảng thời gian'),
      }),
      func: async ({ parentId, metric = 'all', period = '30d' }) => {
        try {
          this.logger.log(`Comparing children for parent: ${parentId}`);

          // Get parent's children
          const parent = await this.prisma.user.findUnique({
            where: { id: parentId },
            include: {
              childRelations: {
                include: {
                  child: {
                    include: {
                      classroomsStudying: {
                        where: { isActive: true },
                        include: {
                          classroom: {
                            include: {
                              course: { select: { id: true, title: true } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          });

          if (!parent || parent.childRelations.length === 0) {
            return JSON.stringify({
              success: true,
              message: 'Bạn chưa có con em nào được liên kết trong hệ thống.',
              children: [],
            });
          }

          if (parent.childRelations.length === 1) {
            return JSON.stringify({
              success: true,
              message:
                'Bạn chỉ có 1 con em. Không thể so sánh. Hãy dùng "get_child_progress" để xem chi tiết.',
              children: parent.childRelations.map((r) => ({
                id: r.child.id,
                name:
                  r.child.displayName ||
                  `${r.child.firstName || ''} ${r.child.lastName || ''}`.trim(),
              })),
            });
          }

          const dateFilter = this.getDateFilter(period);

          // Gather data for each child
          const childrenData = await Promise.all(
            parent.childRelations.map(async (relation) => {
              const child = relation.child;
              const childId = child.id;
              const childName =
                child.displayName ||
                `${child.firstName || ''} ${child.lastName || ''}`.trim() ||
                'Chưa có tên';

              // Get submissions
              const submissions = await this.prisma.assignmentSubmission.findMany({
                where: {
                  studentId: childId,
                  ...(dateFilter && { submittedAt: { gte: dateFilter } }),
                },
                include: {
                  assignment: {
                    select: { totalPoints: true, type: true },
                  },
                },
              });

              // Calculate scores
              const gradedSubmissions = submissions.filter((s) => s.score !== null);
              const avgScore =
                gradedSubmissions.length > 0
                  ? gradedSubmissions.reduce(
                      (sum, s) =>
                        sum + ((s.score || 0) / s.assignment.totalPoints) * 100,
                      0,
                    ) / gradedSubmissions.length
                  : 0;

              // Get attendance
              const classroomIds = child.classroomsStudying.map(
                (cs) => cs.classroomId,
              );
              const sessions = await this.prisma.classroomSession.findMany({
                where: {
                  classroomId: { in: classroomIds },
                  ...(dateFilter && { startTime: { gte: dateFilter } }),
                },
                include: {
                  attendance: {
                    where: { studentId: childId },
                  },
                },
              });

              const totalSessions = sessions.length;
              const attendedSessions = sessions.filter((s) =>
                s.attendance.some((a) => a.status === 'present'),
              ).length;
              const attendanceRate =
                totalSessions > 0 ? (attendedSessions / totalSessions) * 100 : 0;

              // Get activity progress
              const progressRecords = await this.prisma.progress.findMany({
                where: {
                  userId: childId,
                  ...(dateFilter && { updatedAt: { gte: dateFilter } }),
                },
              });
              const completedActivities = progressRecords.filter(
                (p) => p.state === 'done',
              ).length;

              // Get vocabulary progress
              const vocabProgress =
                await this.prisma.userVocabularyProgress.count({
                  where: {
                    userId: childId,
                    status: 'mastered',
                  },
                });

              // Get study time (from study sessions if available)
              const studySessions = await this.prisma.studySession.findMany({
                where: {
                  userId: childId,
                  ...(dateFilter && { startTime: { gte: dateFilter } }),
                },
              });
              const totalStudyMinutes = studySessions.reduce(
                (sum, s) => sum + (s.durationMinutes || 0),
                0,
              );

              // Calculate overall score (weighted)
              const overallScore = Math.round(
                avgScore * 0.4 + // 40% score
                  attendanceRate * 0.3 + // 30% attendance
                  Math.min(100, completedActivities * 2) * 0.2 + // 20% activities
                  Math.min(100, vocabProgress) * 0.1, // 10% vocabulary
              );

              // Identify strengths and weaknesses
              const strengths: string[] = [];
              const weaknesses: string[] = [];

              if (avgScore >= 80) strengths.push('Điểm số xuất sắc');
              else if (avgScore < 60) weaknesses.push('Điểm số cần cải thiện');

              if (attendanceRate >= 90) strengths.push('Chuyên cần tốt');
              else if (attendanceRate < 70) weaknesses.push('Cần đi học đều hơn');

              if (completedActivities >= 20)
                strengths.push('Hoàn thành nhiều bài học');
              else if (completedActivities < 5)
                weaknesses.push('Cần làm thêm bài tập');

              if (vocabProgress >= 50) strengths.push('Từ vựng tốt');

              return {
                id: childId,
                name: childName,
                classes: child.classroomsStudying.length,
                metrics: {
                  avgScore: Math.round(avgScore * 10) / 10,
                  attendanceRate: Math.round(attendanceRate * 10) / 10,
                  completedActivities,
                  totalSubmissions: submissions.length,
                  gradedSubmissions: gradedSubmissions.length,
                  vocabMastered: vocabProgress,
                  studyHours: Math.round(totalStudyMinutes / 60),
                },
                overallScore,
                strengths,
                weaknesses,
                rank: 0, // Will be calculated after
              };
            }),
          );

          // Calculate rankings
          const sortedChildren = [...childrenData].sort(
            (a, b) => b.overallScore - a.overallScore,
          );
          sortedChildren.forEach((child, index) => {
            child.rank = index + 1;
          });

          // Find best in each category
          const bestScore = childrenData.reduce((best, child) =>
            child.metrics.avgScore > best.metrics.avgScore ? child : best,
          );
          const bestAttendance = childrenData.reduce((best, child) =>
            child.metrics.attendanceRate > best.metrics.attendanceRate
              ? child
              : best,
          );
          const mostActive = childrenData.reduce((best, child) =>
            child.metrics.completedActivities > best.metrics.completedActivities
              ? child
              : best,
          );

          // Generate AI recommendations
          const recommendations = await this.generateRecommendations(
            childrenData,
          );

          // Generate comparison chart data
          const chartData = this.generateChartData(childrenData);

          return JSON.stringify({
            success: true,
            summary: {
              totalChildren: childrenData.length,
              period,
              metric,
            },
            comparison: sortedChildren.map((child) => ({
              ...child,
              medal:
                child.rank === 1
                  ? '🥇'
                  : child.rank === 2
                    ? '🥈'
                    : child.rank === 3
                      ? '🥉'
                      : '',
            })),
            highlights: {
              bestScore: {
                name: bestScore.name,
                value: `${bestScore.metrics.avgScore}%`,
              },
              bestAttendance: {
                name: bestAttendance.name,
                value: `${bestAttendance.metrics.attendanceRate}%`,
              },
              mostActive: {
                name: mostActive.name,
                value: `${mostActive.metrics.completedActivities} bài`,
              },
            },
            recommendations,
            charts: chartData,
          });
        } catch (error) {
          this.logger.error('Error comparing children:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể so sánh. Vui lòng thử lại.',
          });
        }
      },
    });
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

  private async generateRecommendations(childrenData: any[]): Promise<any[]> {
    const recommendations: any[] = [];

    childrenData.forEach((child) => {
      const childRecs: string[] = [];

      if (child.metrics.avgScore < 60) {
        childRecs.push('Cần hỗ trợ thêm về bài tập và học tập');
      }
      if (child.metrics.attendanceRate < 80) {
        childRecs.push('Nhắc nhở đi học đầy đủ hơn');
      }
      if (child.metrics.completedActivities < 10) {
        childRecs.push('Khuyến khích làm thêm bài tập trên hệ thống');
      }
      if (child.metrics.studyHours < 5) {
        childRecs.push('Tăng thời gian học mỗi tuần');
      }

      if (childRecs.length === 0) {
        childRecs.push('Tiếp tục duy trì phong độ học tập tốt! 🌟');
      }

      recommendations.push({
        childId: child.id,
        childName: child.name,
        suggestions: childRecs,
        priority:
          child.weaknesses.length > 1
            ? 'high'
            : child.weaknesses.length > 0
              ? 'medium'
              : 'low',
      });
    });

    return recommendations;
  }

  private generateChartData(childrenData: any[]): any[] {
    const charts: any[] = [];

    // Chart 1: Bar - Overall comparison
    charts.push({
      type: 'chart',
      chartType: 'bar',
      title: 'So sánh Overall Score',
      data: childrenData.map((child) => ({
        name: child.name.substring(0, 10),
        'Overall Score': child.overallScore,
        'Điểm TB': child.metrics.avgScore,
      })),
      config: {
        xAxisKey: 'name',
        bars: [
          { dataKey: 'Overall Score', color: '#8B5CF6' },
          { dataKey: 'Điểm TB', color: '#3B82F6' },
        ],
      },
    });

    // Chart 2: Radar - Multi-metric comparison
    if (childrenData.length >= 2) {
      charts.push({
        type: 'chart',
        chartType: 'radar',
        title: 'So sánh đa chiều',
        data: [
          {
            metric: 'Điểm số',
            ...Object.fromEntries(
              childrenData.map((c) => [c.name.substring(0, 8), c.metrics.avgScore]),
            ),
          },
          {
            metric: 'Chuyên cần',
            ...Object.fromEntries(
              childrenData.map((c) => [
                c.name.substring(0, 8),
                c.metrics.attendanceRate,
              ]),
            ),
          },
          {
            metric: 'Bài tập',
            ...Object.fromEntries(
              childrenData.map((c) => [
                c.name.substring(0, 8),
                Math.min(100, c.metrics.completedActivities * 5),
              ]),
            ),
          },
          {
            metric: 'Từ vựng',
            ...Object.fromEntries(
              childrenData.map((c) => [
                c.name.substring(0, 8),
                Math.min(100, c.metrics.vocabMastered * 2),
              ]),
            ),
          },
        ],
        config: {
          radars: childrenData.map((c, i) => ({
            dataKey: c.name.substring(0, 8),
            color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][i % 4],
          })),
        },
      });
    }

    // Chart 3: Bar - Study hours comparison
    charts.push({
      type: 'chart',
      chartType: 'bar',
      title: 'Thời gian học (giờ)',
      data: childrenData.map((child) => ({
        name: child.name.substring(0, 10),
        'Giờ học': child.metrics.studyHours,
        'Bài hoàn thành': child.metrics.completedActivities,
      })),
      config: {
        xAxisKey: 'name',
        bars: [
          { dataKey: 'Giờ học', color: '#10B981' },
          { dataKey: 'Bài hoàn thành', color: '#F59E0B' },
        ],
      },
    });

    return charts;
  }
}
