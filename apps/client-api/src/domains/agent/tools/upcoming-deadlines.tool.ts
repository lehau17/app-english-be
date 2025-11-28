import { PrismaRepository } from '@app/database';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * UpcomingDeadlinesTool - Công cụ xem deadline bài tập sắp tới
 *
 * Features:
 * - Lấy danh sách bài tập sắp đến hạn
 * - Sắp xếp theo độ ưu tiên (urgent, soon, later)
 * - Hiển thị thời gian còn lại
 * - Phân loại theo lớp/khóa học
 * - Cảnh báo bài quá hạn
 */
@Injectable()
export class UpcomingDeadlinesTool {
  private readonly logger = new Logger(UpcomingDeadlinesTool.name);

  constructor(private readonly prisma: PrismaRepository) {}

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_upcoming_deadlines',
      description: `Lấy danh sách deadline bài tập sắp tới của học sinh. Sử dụng khi:
- "deadline gần nhất", "bài tập sắp đến hạn"
- "còn bao lâu nữa phải nộp bài"
- "bài nào cần nộp gấp", "urgent tasks"
- "lịch nộp bài tuần này"
- "có bài nào quá hạn không"
Trả về danh sách deadline với thời gian còn lại, độ ưu tiên, và trạng thái.`,
      schema: z.object({
        userId: z.string().describe('ID của học sinh'),
        days: z
          .number()
          .optional()
          .default(14)
          .describe('Số ngày tới để xem deadline (default: 14)'),
        includeOverdue: z
          .boolean()
          .optional()
          .default(true)
          .describe('Bao gồm bài quá hạn chưa nộp'),
        classroomId: z
          .string()
          .optional()
          .describe('Lọc theo lớp học (optional)'),
      }),
      func: async ({ userId, days = 14, includeOverdue = true, classroomId }) => {
        try {
          this.logger.log(`Getting deadlines for user: ${userId}, days: ${days}`);

          const now = new Date();
          const futureDate = new Date(now);
          futureDate.setDate(futureDate.getDate() + days);

          // Get student's classrooms
          const classroomStudents = await this.prisma.classroomStudent.findMany({
            where: {
              studentId: userId,
              isActive: true,
              ...(classroomId && { classroomId }),
            },
            select: { classroomId: true },
          });

          const classroomIds = classroomStudents.map((cs) => cs.classroomId);

          if (classroomIds.length === 0) {
            return JSON.stringify({
              success: true,
              message: 'Bạn chưa tham gia lớp học nào.',
              deadlines: [],
            });
          }

          // Get assignments with deadlines
          const assignments = await this.prisma.assignment.findMany({
            where: {
              classroomId: { in: classroomIds },
              isPublished: true,
              dueDate: {
                lte: futureDate,
                ...(includeOverdue ? {} : { gte: now }),
              },
            },
            include: {
              classroom: {
                select: {
                  id: true,
                  name: true,
                  course: { select: { title: true } },
                },
              },
              submissions: {
                where: { studentId: userId },
                take: 1,
              },
            },
            orderBy: { dueDate: 'asc' },
          });

          // Process deadlines
          const deadlines = assignments.map((assignment) => {
            const submission = assignment.submissions[0];
            const isSubmitted = !!submission;
            const dueDate = new Date(assignment.dueDate);
            const timeDiff = dueDate.getTime() - now.getTime();
            const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
            const daysLeft = Math.floor(hoursLeft / 24);

            // Determine priority
            let priority: 'overdue' | 'urgent' | 'soon' | 'later';
            let priorityEmoji: string;
            let priorityLabel: string;

            if (timeDiff < 0) {
              priority = 'overdue';
              priorityEmoji = '🔴';
              priorityLabel = 'Quá hạn';
            } else if (hoursLeft < 24) {
              priority = 'urgent';
              priorityEmoji = '🟠';
              priorityLabel = 'Cần nộp gấp';
            } else if (daysLeft <= 3) {
              priority = 'soon';
              priorityEmoji = '🟡';
              priorityLabel = 'Sắp đến hạn';
            } else {
              priority = 'later';
              priorityEmoji = '🟢';
              priorityLabel = 'Còn thời gian';
            }

            // Format time remaining
            let timeRemaining: string;
            if (timeDiff < 0) {
              const overdueDays = Math.abs(daysLeft);
              const overdueHours = Math.abs(hoursLeft) % 24;
              timeRemaining =
                overdueDays > 0
                  ? `Quá hạn ${overdueDays} ngày`
                  : `Quá hạn ${overdueHours} giờ`;
            } else if (hoursLeft < 1) {
              const minutesLeft = Math.floor(timeDiff / (1000 * 60));
              timeRemaining = `${minutesLeft} phút`;
            } else if (hoursLeft < 24) {
              timeRemaining = `${hoursLeft} giờ`;
            } else {
              timeRemaining = `${daysLeft} ngày ${hoursLeft % 24} giờ`;
            }

            return {
              id: assignment.id,
              title: assignment.title,
              type: assignment.type,
              classroom: assignment.classroom.name,
              course: assignment.classroom.course?.title,
              dueDate: dueDate.toISOString(),
              dueDateFormatted: this.formatDate(dueDate),
              timeRemaining,
              hoursLeft,
              priority,
              priorityEmoji,
              priorityLabel,
              totalPoints: assignment.totalPoints,
              status: isSubmitted ? 'submitted' : 'pending',
              statusEmoji: isSubmitted ? '✅' : '',
              submittedAt: submission?.submittedAt?.toISOString() || null,
              score: submission?.score || null,
            };
          });

          // Filter out submitted if needed
          const pendingDeadlines = deadlines.filter((d) => d.status === 'pending');
          const submittedDeadlines = deadlines.filter((d) => d.status === 'submitted');

          // Group by priority
          const overdueCount = pendingDeadlines.filter(
            (d) => d.priority === 'overdue',
          ).length;
          const urgentCount = pendingDeadlines.filter(
            (d) => d.priority === 'urgent',
          ).length;
          const soonCount = pendingDeadlines.filter(
            (d) => d.priority === 'soon',
          ).length;

          // Generate summary message
          let summaryMessage = '';
          if (overdueCount > 0) {
            summaryMessage = `🔴 Có ${overdueCount} bài quá hạn cần nộp gấp!`;
          } else if (urgentCount > 0) {
            summaryMessage = `🟠 Có ${urgentCount} bài cần nộp trong 24h tới!`;
          } else if (soonCount > 0) {
            summaryMessage = `🟡 Có ${soonCount} bài sắp đến hạn trong 3 ngày tới.`;
          } else if (pendingDeadlines.length > 0) {
            summaryMessage = `🟢 Có ${pendingDeadlines.length} bài tập cần hoàn thành.`;
          } else {
            summaryMessage = 'Tuyệt vời! Không có deadline nào sắp tới.';
          }

          // Tips based on situation
          const tips: string[] = [];
          if (overdueCount > 0) {
            tips.push('Nộp bài quá hạn càng sớm càng tốt để giảm điểm trừ.');
          }
          if (urgentCount > 0) {
            tips.push('⏰ Ưu tiên bài cần nộp trong 24h trước.');
          }
          if (pendingDeadlines.length > 3) {
            tips.push('Lập kế hoạch học tập để hoàn thành đúng hạn.');
          }

          return JSON.stringify({
            success: true,
            summary: {
              message: summaryMessage,
              total: deadlines.length,
              pending: pendingDeadlines.length,
              submitted: submittedDeadlines.length,
              overdue: overdueCount,
              urgent: urgentCount,
              soon: soonCount,
            },
            deadlines: pendingDeadlines, // Only show pending by default
            submittedRecently: submittedDeadlines.slice(0, 5),
            tips,
            period: `${days} ngày tới`,
          });
        } catch (error) {
          this.logger.error('Error getting deadlines:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể lấy danh sách deadline. Vui lòng thử lại.',
          });
        }
      },
    });
  }

  private formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    };
    return date.toLocaleDateString('vi-VN', options);
  }
}
