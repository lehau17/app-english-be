import { Injectable, Logger } from '@nestjs/common';import { Injectable, Logger } from '@nestjs/common';

import { RagTool } from './rag.tool';import { RagTool } from './rag.tool';

import { SqlTool } from './sql.tool';import { SqlTool } from './sql.tool';

import { RagService } from '../service/rag.service';import { RagService } from '../service/rag.service';

import { SqlService } from '../service/sql.service';import { SqlService } from '../service/sql.service';



/**@Injectable()

 * Student Agent Tools - Provides tools specifically for studentsexport class StudentAgentTools {

 * Uses RAG and SQL tools for knowledge base and database queries  private readonly logger = new Logger(StudentAgentTools.name);

 */

@Injectable()  constructor(

export class StudentAgentTools {    private ragService: RagService,

  private readonly logger = new Logger(StudentAgentTools.name);    private sqlService: SqlService,

  ) {}

  constructor(

    private ragService: RagService,  getTools() {

    private sqlService: SqlService,    return [

  ) {}      // Core tools for student

      new RagTool(this.ragService),

  getTools() {      new SqlTool(this.sqlService),

    return [

      // Core tools for student role      // Note: Student-specific tools will use SQL tool for now

      new RagTool(this.ragService),      // Future: Add dedicated tools for assignments, progress, leaderboard

      new SqlTool(this.sqlService),    ];

        }

      // Note: Student-specific tools (assignments, progress, leaderboard)}

      // can be added here in the future. For now, SQL tool handles these queries.    return new DynamicStructuredTool({

    ];      name: 'get_my_assignments',

  }      description:

}        'Lấy danh sách bài tập của học sinh. Sử dụng khi học sinh hỏi về bài tập, assignment, homework.',

      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
        limit: z.number().optional().default(10).describe('Số lượng kết quả'),
      }),
      func: async ({ userId, limit = 10 }) => {
        try {
          // Get user's attempts (assignments)
          const attempts = await this.prisma.attempt.findMany({
            where: {
              userId,
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          });

          const summary = {
            total: attempts.length,
            completed: attempts.filter((a) => a.status === 'completed').length,
            inProgress: attempts.filter((a) => a.status === 'in_progress')
              .length,
            submitted: attempts.filter((a) => a.status === 'submitted').length,
            recentAttempts: attempts.map((a) => ({
              id: a.id,
              status: a.status,
              score: a.score,
              maxScore: a.maxScore,
              completedAt: a.completedAt,
              timeSpent: a.timeSpent ? `${Math.round(a.timeSpent / 60)}p` : null,
            })),
          };

          return JSON.stringify(summary, null, 2);
        } catch (error) {
          this.logger.error('Error getting assignments:', error);
          return 'Không thể lấy danh sách bài tập. Vui lòng thử lại.';
        }
      },
    });
  }

  private getMyProgressTool() {
    return new DynamicStructuredTool({
      name: 'get_my_progress',
      description:
        'Lấy tiến độ học tập của học sinh (lessons completed, current level, achievements)',
      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
      }),
      func: async ({ userId }) => {
        try {
          // Get user progress
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
              enrollments: {
                include: {
                  course: {
                    select: {
                      title: true,
                      totalLessons: true,
                    },
                  },
                },
              },
            },
          });

          if (!user) {
            return 'Không tìm thấy thông tin học sinh.';
          }

          // Get completed lessons count
          const completedLessons = await this.prisma.lessonProgress.count({
            where: {
              userId,
              state: 'done',
            },
          });

          // Get current streak
          const recentActivity = await this.prisma.lessonProgress.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            take: 7,
          });

          const progress = {
            totalEnrollments: user.enrollments.length,
            completedLessons,
            currentLevel: user.level || 'Beginner',
            streakDays: this.calculateStreak(recentActivity),
            enrollments: user.enrollments.map((e) => ({
              course: e.course.title,
              progress: `${e.completedLessons || 0}/${e.course.totalLessons || 0}`,
              completionRate: e.course.totalLessons
                ? Math.round(
                    ((e.completedLessons || 0) / e.course.totalLessons) * 100,
                  )
                : 0,
            })),
          };

          return JSON.stringify(progress, null, 2);
        } catch (error) {
          this.logger.error('Error getting progress:', error);
          return 'Không thể lấy thông tin tiến độ. Vui lòng thử lại.';
        }
      },
    });
  }

  private findLessonsTool() {
    return new DynamicStructuredTool({
      name: 'find_lessons',
      description:
        'Tìm kiếm bài học theo chủ đề hoặc độ khó. Sử dụng khi học sinh muốn học thêm về một topic cụ thể.',
      schema: z.object({
        query: z.string().describe('Từ khóa tìm kiếm (topic, skill type)'),
        limit: z.number().optional().default(5).describe('Số lượng kết quả'),
      }),
      func: async ({ query, limit = 5 }) => {
        try {
          const lessons = await this.prisma.lesson.findMany({
            where: {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
              isActive: true,
            },
            select: {
              id: true,
              title: true,
              description: true,
              difficulty: true,
              estimatedDuration: true,
            },
            take: limit,
          });

          if (lessons.length === 0) {
            return `Không tìm thấy bài học nào về "${query}". Hãy thử từ khóa khác.`;
          }

          const result = {
            query,
            found: lessons.length,
            lessons: lessons.map((l) => ({
              id: l.id,
              title: l.title,
              description: l.description,
              difficulty: l.difficulty,
              duration: `${l.estimatedDuration || 30} phút`,
            })),
          };

          return JSON.stringify(result, null, 2);
        } catch (error) {
          this.logger.error('Error finding lessons:', error);
          return 'Không thể tìm kiếm bài học. Vui lòng thử lại.';
        }
      },
    });
  }

  private getLeaderboardTool() {
    return new DynamicStructuredTool({
      name: 'get_leaderboard',
      description:
        'Lấy bảng xếp hạng học sinh theo điểm hoặc streak. Sử dụng khi học sinh muốn xem thứ hạng của mình.',
      schema: z.object({
        userId: z.string().describe('ID của học sinh hiện tại'),
        type: z
          .enum(['points', 'streak'])
          .optional()
          .default('points')
          .describe('Loại xếp hạng'),
        limit: z.number().optional().default(10).describe('Số lượng top users'),
      }),
      func: async ({ userId, type = 'points', limit = 10 }) => {
        try {
          // Get top students
          const topStudents = await this.prisma.user.findMany({
            where: {
              role: 'student',
            },
            orderBy:
              type === 'points'
                ? { totalPoints: 'desc' }
                : { currentStreak: 'desc' },
            take: limit,
            select: {
              id: true,
              fullName: true,
              totalPoints: true,
              currentStreak: true,
            },
          });

          // Find current user's rank
          const currentUser = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
              fullName: true,
              totalPoints: true,
              currentStreak: true,
            },
          });

          const userRank =
            topStudents.findIndex((u) => u.id === userId) + 1 || 'Ngoài top';

          const leaderboard = {
            type: type === 'points' ? 'Điểm số' : 'Streak',
            myRank: userRank,
            myScore:
              type === 'points'
                ? currentUser?.totalPoints || 0
                : currentUser?.currentStreak || 0,
            topStudents: topStudents.map((s, idx) => ({
              rank: idx + 1,
              name: s.fullName,
              score:
                type === 'points'
                  ? `${s.totalPoints || 0} điểm`
                  : `${s.currentStreak || 0} ngày`,
              isMe: s.id === userId,
            })),
          };

          return JSON.stringify(leaderboard, null, 2);
        } catch (error) {
          this.logger.error('Error getting leaderboard:', error);
          return 'Không thể lấy bảng xếp hạng. Vui lòng thử lại.';
        }
      },
    });
  }

  private calculateStreak(activities: any[]): number {
    if (activities.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < activities.length; i++) {
      const activityDate = new Date(activities[i].updatedAt);
      activityDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (today.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff === i) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
