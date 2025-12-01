import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { RagService } from '../service/rag.service';
import { SqlService } from '../service/sql.service';
import { ChartGeneratorTool } from './chart-generator.tool';
import { CompareChildrenTool } from './compare-children.tool';
import { PaymentTrackerTool } from './payment-tracker.tool';
import { RagTool } from './rag.tool';
import { SqlTool } from './sql.tool';
import { StudentAnalyticsTool } from './student-analytics.tool';

@Injectable()
export class ParentAgentTools {
  private readonly logger = new Logger(ParentAgentTools.name);

  constructor(
    private ragService: RagService,
    private sqlService: SqlService,
    private prisma: PrismaRepository,
    private chartTool: ChartGeneratorTool,
    private studentAnalytics: StudentAnalyticsTool,
    private gemini: GeminiService,
  ) {}

  getTools() {
    const compareChildren = new CompareChildrenTool(this.prisma, this.gemini);
    const paymentTracker = new PaymentTrackerTool(this.prisma, this.gemini);

    return [
      // Core tools
      new RagTool(this.ragService),
      new SqlTool(this.sqlService),
      this.chartTool,

      // Parent-specific tools
      this.getMyChildrenTool(),
      this.getChildProgressTool(),
      this.getChildAssignmentsTool(),
      this.getChildScoresTool(),
      this.getChildScheduleTool(),
      this.getPaymentStatusTool(),
      this.getChildReportTool(),

      // Compare children tool
      compareChildren.getTool(),

      // Payment tracker tools (for checking payment status)
      ...paymentTracker.getTools(),

      // Student analytics (for child analysis with AI insights and charts)
      this.studentAnalytics,
    ];
  }

  /**
   * Get list of children for parent
   */
  private getMyChildrenTool() {
    return new DynamicStructuredTool({
      name: 'get_my_children',
      description: `Lấy danh sách con em của phụ huynh. Trả về thông tin: tên, lớp học, khóa học, trạng thái học tập.`,
      schema: z.object({
        userId: z.string().describe('ID của phụ huynh'),
      }),
      func: async ({ userId }) => {
        try {
          const parent = await this.prisma.user.findUnique({
            where: { id: userId },
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
                              course: {
                                select: {
                                  id: true,
                                  title: true,
                                  name: true,
                                },
                              },
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

          if (!parent || !parent.childRelations.length) {
            return JSON.stringify({
              success: true,
              children: [],
              message: 'Bạn chưa có con em nào được liên kết trong hệ thống.',
            });
          }

          const children = parent.childRelations.map((relation) => {
            const child = relation.child;
            const classes = child.classroomsStudying.map((cs) => ({
              id: cs.classroom.id,
              name: cs.classroom.name,
              course: cs.classroom.course.title || cs.classroom.course.name,
            }));

            return {
              id: child.id,
              name: child.displayName || `${child.firstName || ''} ${child.lastName || ''}`.trim() || 'Chưa có tên',
              email: child.email,
              phone: child.phone,
              classes,
              totalClasses: classes.length,
            };
          });

          return JSON.stringify({
            success: true,
            children,
            total: children.length,
          });
        } catch (error) {
          this.logger.error('Error getting children:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể lấy danh sách con em. Vui lòng thử lại sau.',
          });
        }
      },
    });
  }

  /**
   * Get child's learning progress
   */
  private getChildProgressTool() {
    return new DynamicStructuredTool({
      name: 'get_child_progress',
      description: `Xem tiến độ học tập của con em. Trả về: số bài đã học, số bài đã hoàn thành, tỷ lệ hoàn thành, điểm trung bình.`,
      schema: z.object({
        childId: z.string().describe('ID của con em'),
        courseId: z.string().optional().describe('ID khóa học (tùy chọn, nếu không có sẽ lấy tất cả)'),
      }),
      func: async ({ childId, courseId }) => {
        try {
          const where: any = { studentId: childId };
          if (courseId) {
            where.assignment = { courseId };
          }

          const submissions = await this.prisma.assignmentSubmission.findMany({
            where,
            include: {
              assignment: {
                select: {
                  id: true,
                  title: true,
                  totalPoints: true,
                  courseId: true,
                },
              },
            },
          });

          const totalAssignments = await this.prisma.assignment.count({
            where: courseId ? { courseId } : {},
          });

          const completed = submissions.filter((s) => s.score !== null).length;
          const avgScore =
            submissions.length > 0
              ? submissions
                  .filter((s) => s.score !== null)
                  .reduce((sum, s) => sum + (s.score || 0), 0) /
                submissions.filter((s) => s.score !== null).length
              : 0;

          const progressPercentage =
            totalAssignments > 0 ? (completed / totalAssignments) * 100 : 0;

          return JSON.stringify({
            success: true,
            childId,
            totalAssignments,
            completed,
            pending: totalAssignments - completed,
            progressPercentage: Math.round(progressPercentage * 100) / 100,
            averageScore: Math.round(avgScore * 100) / 100,
            submissions: submissions.slice(0, 10).map((s) => ({
              assignmentTitle: s.assignment.title,
              score: s.score,
              totalPoints: s.assignment.totalPoints,
              submittedAt: s.submittedAt,
            })),
          });
        } catch (error) {
          this.logger.error('Error getting child progress:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể lấy tiến độ học tập. Vui lòng thử lại sau.',
          });
        }
      },
    });
  }

  /**
   * Get child's assignments
   */
  private getChildAssignmentsTool() {
    return new DynamicStructuredTool({
      name: 'get_child_assignments',
      description: `Lấy danh sách bài tập của con em. Trả về: bài tập đã nộp, chưa nộp, quá hạn.`,
      schema: z.object({
        childId: z.string().describe('ID của con em'),
        status: z.enum(['all', 'submitted', 'pending', 'overdue']).optional().describe('Lọc theo trạng thái'),
      }),
      func: async ({ childId, status = 'all' }) => {
        try {
          const assignments = await this.prisma.assignment.findMany({
            where: {
              course: {
                classrooms: {
                  some: {
                    students: {
                      some: {
                        studentId: childId,
                        isActive: true,
                      },
                    },
                  },
                },
              },
            },
            include: {
              submissions: {
                where: { studentId: childId },
                take: 1,
              },
            },
            orderBy: { dueDate: 'desc' },
          });

          const now = new Date();
          const result = assignments.map((assignment) => {
            const submission = assignment.submissions[0];
            const isSubmitted = !!submission && submission.score !== null;
            const isOverdue = !isSubmitted && assignment.dueDate < now;

            return {
              id: assignment.id,
              title: assignment.title,
              dueDate: assignment.dueDate,
              totalPoints: assignment.totalPoints,
              status: isSubmitted ? 'submitted' : isOverdue ? 'overdue' : 'pending',
              score: submission?.score || null,
              submittedAt: submission?.submittedAt || null,
            };
          });

          let filtered = result;
          if (status !== 'all') {
            filtered = result.filter((a) => a.status === status);
          }

          return JSON.stringify({
            success: true,
            childId,
            assignments: filtered,
            total: filtered.length,
            summary: {
              submitted: result.filter((a) => a.status === 'submitted').length,
              pending: result.filter((a) => a.status === 'pending').length,
              overdue: result.filter((a) => a.status === 'overdue').length,
            },
          });
        } catch (error) {
          this.logger.error('Error getting child assignments:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể lấy danh sách bài tập. Vui lòng thử lại sau.',
          });
        }
      },
    });
  }

  /**
   * Get child's scores
   */
  private getChildScoresTool() {
    return new DynamicStructuredTool({
      name: 'get_child_scores',
      description: `Xem điểm số của con em. Trả về: điểm trung bình, điểm cao nhất, thấp nhất, danh sách điểm theo bài.`,
      schema: z.object({
        childId: z.string().describe('ID của con em'),
        courseId: z.string().optional().describe('ID khóa học (tùy chọn)'),
      }),
      func: async ({ childId, courseId }) => {
        try {
          const where: any = {
            studentId: childId,
            score: { not: null },
          };

          if (courseId) {
            where.assignment = { courseId };
          }

          const submissions = await this.prisma.assignmentSubmission.findMany({
            where,
            include: {
              assignment: {
                select: {
                  id: true,
                  title: true,
                  totalPoints: true,
                  courseId: true,
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
          });

          if (submissions.length === 0) {
            return JSON.stringify({
              success: true,
              childId,
              message: 'Con em chưa có điểm số nào.',
              scores: [],
            });
          }

          const scores = submissions.map((s) => ({
            assignmentTitle: s.assignment.title,
            score: s.score,
            totalPoints: s.assignment.totalPoints,
            percentage: Math.round(((s.score || 0) / s.assignment.totalPoints) * 100),
            submittedAt: s.submittedAt,
          }));

          const percentages = scores.map((s) => s.percentage);
          const avgScore = percentages.reduce((a, b) => a + b, 0) / percentages.length;
          const maxScore = Math.max(...percentages);
          const minScore = Math.min(...percentages);

          return JSON.stringify({
            success: true,
            childId,
            summary: {
              totalAssignments: scores.length,
              averageScore: Math.round(avgScore * 100) / 100,
              maxScore,
              minScore,
            },
            scores: scores.slice(0, 20), // Last 20 scores
          });
        } catch (error) {
          this.logger.error('Error getting child scores:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể lấy điểm số. Vui lòng thử lại sau.',
          });
        }
      },
    });
  }

  /**
   * Get child's schedule
   */
  private getChildScheduleTool() {
    return new DynamicStructuredTool({
      name: 'get_child_schedule',
      description: `Xem lịch học của con em. Trả về: lịch học theo tuần, lớp học, giáo viên, thời gian.`,
      schema: z.object({
        childId: z.string().describe('ID của con em'),
      }),
      func: async ({ childId }) => {
        try {
          const classrooms = await this.prisma.classroomStudent.findMany({
            where: {
              studentId: childId,
              isActive: true,
            },
            include: {
              classroom: {
                include: {
                  course: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                  teacher: {
                    select: {
                      displayName: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                  slots: {
                    orderBy: { dayOfWeek: 'asc' },
                  },
                },
              },
            },
          });

          const schedule = classrooms.map((cs) => {
            const classroom = cs.classroom;
            const teacherName =
              classroom.teacher?.displayName ||
              `${classroom.teacher?.firstName || ''} ${classroom.teacher?.lastName || ''}`.trim() ||
              'Chưa có giáo viên';

            const slots = classroom.slots.map((slot) => {
              const dayLabels: Record<string, string> = {
                mon: 'Thứ 2',
                tue: 'Thứ 3',
                wed: 'Thứ 4',
                thu: 'Thứ 5',
                fri: 'Thứ 6',
                sat: 'Thứ 7',
                sun: 'Chủ nhật',
              };

              const hours = Math.floor(slot.startMinuteOfDay / 60);
              const minutes = slot.startMinuteOfDay % 60;
              const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

              const endHours = Math.floor(slot.endMinuteOfDay / 60);
              const endMinutes = slot.endMinuteOfDay % 60;
              const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

              return {
                day: dayLabels[slot.dayOfWeek] || slot.dayOfWeek,
                time: `${startTime} - ${endTime}`,
              };
            });

            return {
              classroomId: classroom.id,
              classroomName: classroom.name,
              course: classroom.course.title || classroom.course.name,
              teacher: teacherName,
              schedule: slots,
            };
          });

          return JSON.stringify({
            success: true,
            childId,
            schedule,
            totalClasses: schedule.length,
          });
        } catch (error) {
          this.logger.error('Error getting child schedule:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể lấy lịch học. Vui lòng thử lại sau.',
          });
        }
      },
    });
  }

  /**
   * Get payment status
   */
  private getPaymentStatusTool() {
    return new DynamicStructuredTool({
      name: 'get_payment_status',
      description: `Kiểm tra trạng thái thanh toán học phí của con em. Trả về: các khoản đã thanh toán, chưa thanh toán, tổng số tiền.`,
      schema: z.object({
        childId: z.string().describe('ID của con em'),
      }),
      func: async ({ childId }) => {
        try {
          const payments = await this.prisma.payment.findMany({
            where: {
              studentId: childId,
            },
            include: {
              course: {
                select: {
                  title: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          });

          const totalPaid = payments
            .filter((p) => p.status === 'SUCCESS')
            .reduce((sum, p) => sum + (p.amount || 0), 0);

          const pending = payments.filter((p) => p.status === 'PENDING').length;

          return JSON.stringify({
            success: true,
            childId,
            payments: payments.slice(0, 10).map((p) => ({
              id: p.id,
              course: p.course?.title || p.course?.name || 'N/A',
              amount: p.amount,
              status: p.status,
              createdAt: p.createdAt,
            })),
            summary: {
              totalPayments: payments.length,
              totalPaid,
              pending,
              success: payments.filter((p) => p.status === 'SUCCESS').length,
            },
          });
        } catch (error) {
          this.logger.error('Error getting payment status:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể lấy thông tin thanh toán. Vui lòng thử lại sau.',
          });
        }
      },
    });
  }

  /**
   * Get comprehensive child report
   */
  private getChildReportTool() {
    return new DynamicStructuredTool({
      name: 'get_child_report',
      description: `Lấy báo cáo tổng quan về con em. Bao gồm: tiến độ học tập, điểm số, lịch học, thanh toán.`,
      schema: z.object({
        childId: z.string().describe('ID của con em'),
      }),
      func: async ({ childId }) => {
        try {
          // Get all data
          const [child, submissions, classrooms, payments] = await Promise.all([
            this.prisma.user.findUnique({
              where: { id: childId },
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            }),
            this.prisma.assignmentSubmission.findMany({
              where: { studentId: childId, score: { not: null } },
              include: {
                assignment: {
                  select: { totalPoints: true },
                },
              },
            }),
            this.prisma.classroomStudent.findMany({
              where: { studentId: childId, isActive: true },
              include: {
                classroom: {
                  include: {
                    course: {
                      select: { title: true },
                    },
                  },
                },
              },
            }),
            this.prisma.payment.findMany({
              where: { studentId: childId, status: 'SUCCESS' },
            }),
          ]);

          if (!child) {
            return JSON.stringify({
              success: false,
              error: 'Không tìm thấy thông tin con em.',
            });
          }

          const childName =
            child.displayName || `${child.firstName || ''} ${child.lastName || ''}`.trim() || 'Chưa có tên';

          const avgScore =
            submissions.length > 0
              ? submissions.reduce((sum, s) => sum + ((s.score || 0) / s.assignment.totalPoints) * 100, 0) /
                submissions.length
              : 0;

          const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

          return JSON.stringify({
            success: true,
            child: {
              id: child.id,
              name: childName,
              email: child.email,
            },
            summary: {
              totalClasses: classrooms.length,
              totalAssignments: submissions.length,
              averageScore: Math.round(avgScore * 100) / 100,
              totalPaid,
            },
            classes: classrooms.map((cs) => ({
              name: cs.classroom.name,
              course: cs.classroom.course.title,
            })),
          });
        } catch (error) {
          this.logger.error('Error getting child report:', error);
          return JSON.stringify({
            success: false,
            error: 'Không thể tạo báo cáo. Vui lòng thử lại sau.',
          });
        }
      },
    });
  }
}

