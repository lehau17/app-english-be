import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { z } from 'zod';

/**
 * Payment Tracker Tool
 *
 * Provides comprehensive payment analytics and tracking for administrators and parents.
 * Tracks transactions, revenue, payment status, and generates financial reports.
 */
@Injectable()
export class PaymentTrackerTool {
  private readonly logger = new Logger(PaymentTrackerTool.name);

  constructor(
    private prisma: PrismaRepository,
    private gemini: GeminiService,
  ) {}

  /**
   * Returns array of payment tracking tools
   */
  getTools(): DynamicStructuredTool[] {
    return [
      this.getPaymentHistoryTool(),
      this.getRevenueReportTool(),
      this.getPendingPaymentsTool(),
      this.getStudentPaymentStatusTool(),
    ];
  }

  /**
   * Tool 1: Get payment history
   * View transaction history with filters
   */
  private getPaymentHistoryTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'payment_history',
      description: `Xem lich su giao dich thanh toan voi bo loc.

Su dung tool nay khi:
- Admin hoi "lich su thanh toan"
- Admin hoi "giao dich gan day"
- Phu huynh hoi "toi da thanh toan nhung gi"
- Nguoi dung muon xem chi tiet giao dich

Ket qua tra ve:
- Danh sach giao dich
- Trang thai thanh toan
- So tien, khoa hoc, ngay
- Thong ke tong hop`,
      schema: z.object({
        studentId: z.string().optional().describe('UUID hoc sinh (cho phu huynh)'),
        status: z.enum(['pending', 'success', 'failed', 'cancelled', 'refunded', 'expired', 'all']).optional().default('all'),
        fromDate: z.string().optional().describe('Ngay bat dau (YYYY-MM-DD)'),
        toDate: z.string().optional().describe('Ngay ket thuc (YYYY-MM-DD)'),
        courseId: z.string().optional().describe('Loc theo khoa hoc'),
        limit: z.number().optional().default(50),
      }),
      func: async ({ studentId, status = 'all', fromDate, toDate, courseId, limit = 50 }) => {
        try {
          this.logger.log(`Payment history: studentId=${studentId}, status=${status}`);

          // Build filter
          const where: any = {};

          if (studentId) {
            where.studentId = studentId;
          }

          if (status !== 'all') {
            where.status = status as PaymentStatus;
          }

          if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) where.createdAt.gte = new Date(fromDate);
            if (toDate) where.createdAt.lte = new Date(toDate);
          }

          if (courseId) {
            where.courseId = courseId;
          }

          // Get transactions
          const transactions = await this.prisma.transaction.findMany({
            where,
            include: {
              student: {
                select: { id: true, displayName: true, email: true },
              },
              course: {
                select: { id: true, title: true, price: true },
              },
              classroom: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          });

          // Calculate summary
          const totalAmount = transactions
            .filter((t) => t.status === 'success')
            .reduce((sum, t) => sum + t.amount, 0);

          const statusBreakdown = {
            pending: transactions.filter((t) => t.status === 'pending').length,
            success: transactions.filter((t) => t.status === 'success').length,
            failed: transactions.filter((t) => t.status === 'failed').length,
            cancelled: transactions.filter((t) => t.status === 'cancelled').length,
            refunded: transactions.filter((t) => t.status === 'refunded').length,
            expired: transactions.filter((t) => t.status === 'expired').length,
          };

          const formattedTransactions = transactions.map((t) => ({
            id: t.id,
            amount: t.amount,
            currency: t.currency,
            type: t.type,
            status: t.status,
            provider: t.provider,
            student: t.student?.displayName || 'Guest',
            studentEmail: t.student?.email,
            course: t.course?.title,
            classroom: t.classroom?.name,
            description: t.description,
            vnpayTxnRef: t.vnpayTxnRef,
            createdAt: t.createdAt,
            completedAt: t.completedAt,
          }));

          return JSON.stringify({
            success: true,
            summary: {
              totalTransactions: transactions.length,
              totalSuccessAmount: totalAmount,
              statusBreakdown,
            },
            transactions: formattedTransactions,
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Payment history error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: `Loi lay lich su: ${error.message}`,
          });
        }
      },
    });
  }

  /**
   * Tool 2: Get revenue report
   * Financial analytics for administrators
   */
  private getRevenueReportTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'revenue_report',
      description: `Bao cao doanh thu chi tiet cho admin.

Su dung tool nay khi:
- Admin hoi "doanh thu thang nay"
- Admin hoi "bao cao tai chinh"
- Admin hoi "khoa hoc nao ban chay nhat"
- Nguoi dung muon xem thong ke doanh thu

Ket qua tra ve:
- Tong doanh thu theo thoi gian
- Doanh thu theo khoa hoc
- Doanh thu theo ngay/tuan/thang
- Bieu do xu huong
- So sanh giai doan`,
      schema: z.object({
        period: z.enum(['week', 'month', 'quarter', 'year']).optional().default('month'),
        groupBy: z.enum(['day', 'week', 'month', 'course']).optional().default('day'),
        includeCharts: z.boolean().optional().default(true),
      }),
      func: async ({ period = 'month', groupBy = 'day', includeCharts = true }) => {
        try {
          this.logger.log(`Revenue report: period=${period}, groupBy=${groupBy}`);

          const startDate = this.getStartDate(period);

          // Get successful transactions
          const transactions = await this.prisma.transaction.findMany({
            where: {
              status: 'success',
              createdAt: { gte: startDate },
            },
            include: {
              course: {
                select: { id: true, title: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          });

          // Total revenue
          const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
          const totalTransactions = transactions.length;
          const avgTransactionValue = totalTransactions > 0
            ? Math.round(totalRevenue / totalTransactions)
            : 0;

          // Group by time period
          const timeGroups = new Map<string, { date: string; amount: number; count: number }>();

          transactions.forEach((t) => {
            let key: string;
            const date = new Date(t.createdAt);

            switch (groupBy) {
              case 'week':
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split('T')[0];
                break;
              case 'month':
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                break;
              default:
                key = date.toISOString().split('T')[0];
            }

            if (!timeGroups.has(key)) {
              timeGroups.set(key, { date: key, amount: 0, count: 0 });
            }
            const group = timeGroups.get(key)!;
            group.amount += t.amount;
            group.count++;
          });

          const timeSeriesData = Array.from(timeGroups.values())
            .sort((a, b) => a.date.localeCompare(b.date));

          // Revenue by course
          const courseRevenue = new Map<string, { courseId: string; courseTitle: string; amount: number; count: number }>();

          transactions.forEach((t) => {
            if (t.course) {
              if (!courseRevenue.has(t.course.id)) {
                courseRevenue.set(t.course.id, {
                  courseId: t.course.id,
                  courseTitle: t.course.title,
                  amount: 0,
                  count: 0,
                });
              }
              const cr = courseRevenue.get(t.course.id)!;
              cr.amount += t.amount;
              cr.count++;
            }
          });

          const courseRevenueData = Array.from(courseRevenue.values())
            .sort((a, b) => b.amount - a.amount);

          // Transaction type breakdown
          const typeBreakdown = {
            course_purchase: transactions.filter((t) => t.type === 'course_purchase').reduce((s, t) => s + t.amount, 0),
            lesson_unlock: transactions.filter((t) => t.type === 'lesson_unlock').reduce((s, t) => s + t.amount, 0),
            refund: transactions.filter((t) => t.type === 'refund').reduce((s, t) => s + t.amount, 0),
            bonus: transactions.filter((t) => t.type === 'bonus').reduce((s, t) => s + t.amount, 0),
          };

          // Provider breakdown
          const providerBreakdown = new Map<string, number>();
          transactions.forEach((t) => {
            providerBreakdown.set(t.provider, (providerBreakdown.get(t.provider) || 0) + t.amount);
          });

          // Generate charts
          const charts: any[] = [];
          if (includeCharts) {
            // Chart 1: Revenue trend
            if (timeSeriesData.length > 0) {
              charts.push({
                type: 'chart',
                chartType: 'line',
                title: `Doanh thu theo ${groupBy === 'day' ? 'ngay' : groupBy === 'week' ? 'tuan' : 'thang'}`,
                data: timeSeriesData.slice(-14).map((d) => ({
                  name: groupBy === 'day'
                    ? new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                    : d.date,
                  value: Math.round(d.amount / 1000), // In thousands
                })),
                config: {
                  xLabel: groupBy === 'day' ? 'Ngay' : groupBy === 'week' ? 'Tuan' : 'Thang',
                  yLabel: 'Doanh thu (nghìn VND)',
                  colors: ['#10b981'],
                },
              });
            }

            // Chart 2: Revenue by course
            if (courseRevenueData.length > 0) {
              charts.push({
                type: 'chart',
                chartType: 'bar',
                title: 'Doanh thu theo khoa hoc',
                data: courseRevenueData.slice(0, 8).map((c) => ({
                  name: c.courseTitle.substring(0, 15),
                  value: Math.round(c.amount / 1000),
                })),
                config: {
                  xLabel: 'Khoa hoc',
                  yLabel: 'Doanh thu (nghìn VND)',
                  colors: ['#3b82f6'],
                },
              });
            }

            // Chart 3: Payment provider distribution
            if (providerBreakdown.size > 0) {
              charts.push({
                type: 'chart',
                chartType: 'pie',
                title: 'Phan bo theo phuong thuc thanh toan',
                data: Array.from(providerBreakdown.entries()).map(([provider, amount]) => ({
                  name: provider.toUpperCase(),
                  value: Math.round(amount / 1000),
                })),
                config: {
                  colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
                  legend: true,
                },
              });
            }

            // Chart 4: Transaction count trend
            if (timeSeriesData.length > 0) {
              charts.push({
                type: 'chart',
                chartType: 'bar',
                title: 'So giao dich theo thoi gian',
                data: timeSeriesData.slice(-14).map((d) => ({
                  name: groupBy === 'day'
                    ? new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                    : d.date,
                  value: d.count,
                })),
                config: {
                  xLabel: groupBy === 'day' ? 'Ngay' : groupBy === 'week' ? 'Tuan' : 'Thang',
                  yLabel: 'So giao dich',
                  colors: ['#8b5cf6'],
                },
              });
            }
          }

          // AI insights
          const aiInsights = await this.generateRevenueInsights({
            totalRevenue,
            totalTransactions,
            avgTransactionValue,
            topCourse: courseRevenueData[0],
            trend: timeSeriesData,
          });

          return JSON.stringify({
            success: true,
            period,
            summary: {
              totalRevenue,
              totalTransactions,
              avgTransactionValue,
              currency: 'VND',
            },
            typeBreakdown,
            providerBreakdown: Object.fromEntries(providerBreakdown),
            topCourses: courseRevenueData.slice(0, 10),
            timeSeriesData: timeSeriesData.slice(-30),
            charts,
            insights: aiInsights,
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Revenue report error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: `Loi tao bao cao: ${error.message}`,
          });
        }
      },
    });
  }

  /**
   * Tool 3: Get pending payments
   * List transactions that need attention
   */
  private getPendingPaymentsTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'pending_payments',
      description: `Danh sach giao dich dang cho xu ly hoac can chu y.

Su dung tool nay khi:
- Admin hoi "giao dich dang cho"
- Admin hoi "thanh toan chua hoan tat"
- Nguoi dung muon xem giao dich can xu ly
- Kiem tra giao dich bi loi

Ket qua tra ve:
- Danh sach giao dich pending
- Giao dich failed can kiem tra
- Thoi gian cho
- Goi y xu ly`,
      schema: z.object({
        includeExpired: z.boolean().optional().default(true).describe('Bao gom giao dich het han'),
        includeFailed: z.boolean().optional().default(true).describe('Bao gom giao dich that bai'),
        limit: z.number().optional().default(50),
      }),
      func: async ({ includeExpired = true, includeFailed = true, limit = 50 }) => {
        try {
          this.logger.log(`Pending payments: expired=${includeExpired}, failed=${includeFailed}`);

          const statusFilter: PaymentStatus[] = ['pending'];
          if (includeExpired) statusFilter.push('expired');
          if (includeFailed) statusFilter.push('failed');

          const transactions = await this.prisma.transaction.findMany({
            where: {
              status: { in: statusFilter },
            },
            include: {
              student: {
                select: { id: true, displayName: true, email: true, phone: true },
              },
              course: {
                select: { id: true, title: true, price: true },
              },
              classroom: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          });

          // Categorize by status
          const pending = transactions.filter((t) => t.status === 'pending');
          const expired = transactions.filter((t) => t.status === 'expired');
          const failed = transactions.filter((t) => t.status === 'failed');

          // Calculate waiting time
          const now = new Date();
          const pendingWithAge = pending.map((t) => {
            const ageMinutes = Math.round((now.getTime() - new Date(t.createdAt).getTime()) / 60000);
            return {
              ...this.formatTransaction(t),
              ageMinutes,
              ageText: this.formatAge(ageMinutes),
              isStale: ageMinutes > 30, // More than 30 minutes
            };
          });

          const failedFormatted = failed.map((t) => ({
            ...this.formatTransaction(t),
            responseCode: t.vnpayResponseCode,
          }));

          const expiredFormatted = expired.map((t) => this.formatTransaction(t));

          // Summary
          const summary = {
            totalPending: pending.length,
            totalExpired: expired.length,
            totalFailed: failed.length,
            totalAmount: pending.reduce((s, t) => s + t.amount, 0),
            staleTransactions: pendingWithAge.filter((t) => t.isStale).length,
          };

          // Recommendations
          const recommendations: string[] = [];
          if (summary.staleTransactions > 0) {
            recommendations.push(`Co ${summary.staleTransactions} giao dich dang cho qua 30 phut - kiem tra trang thai`);
          }
          if (failed.length > 0) {
            recommendations.push(`Co ${failed.length} giao dich that bai - lien he hoc sinh de ho tro`);
          }
          if (expired.length > 0) {
            recommendations.push(`Co ${expired.length} giao dich het han - co the gui nhac nho thanh toan lai`);
          }
          if (summary.totalPending === 0 && failed.length === 0 && expired.length === 0) {
            recommendations.push('Khong co giao dich can xu ly');
          }

          return JSON.stringify({
            success: true,
            summary,
            pending: pendingWithAge,
            failed: failedFormatted,
            expired: expiredFormatted,
            recommendations,
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Pending payments error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: `Loi lay danh sach: ${error.message}`,
          });
        }
      },
    });
  }

  /**
   * Tool 4: Get student payment status
   * For parents to check their child's payment status
   */
  private getStudentPaymentStatusTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'student_payment_status',
      description: `Tinh trang thanh toan cua hoc sinh - cho phu huynh va admin.

Su dung tool nay khi:
- Phu huynh hoi "toi da dong hoc phi chua"
- Phu huynh hoi "con toi dang hoc nhung khoa nao"
- Admin hoi "hoc sinh X da thanh toan gi"
- Kiem tra tinh trang dang ky khoa hoc

Ket qua tra ve:
- Khoa hoc da mua
- Giao dich thanh cong
- Giao dich dang cho
- Tong chi phi da thanh toan`,
      schema: z.object({
        studentId: z.string().optional().describe('UUID hoc sinh'),
        studentEmail: z.string().optional().describe('Email hoc sinh de tim'),
        studentName: z.string().optional().describe('Ten hoc sinh de tim'),
      }),
      func: async ({ studentId, studentEmail, studentName }) => {
        try {
          this.logger.log(`Student payment status: ${studentId || studentEmail || studentName}`);

          // Find student
          if (!studentId) {
            const whereClause: any = { role: 'student' };
            if (studentEmail) {
              whereClause.email = { contains: studentEmail, mode: 'insensitive' };
            } else if (studentName) {
              whereClause.OR = [
                { displayName: { contains: studentName, mode: 'insensitive' } },
                { firstName: { contains: studentName, mode: 'insensitive' } },
                { lastName: { contains: studentName, mode: 'insensitive' } },
              ];
            } else {
              return JSON.stringify({
                success: false,
                error: 'Vui long cung cap studentId, studentEmail hoac studentName',
              });
            }

            const student = await this.prisma.user.findFirst({ where: whereClause });
            if (!student) {
              return JSON.stringify({
                success: false,
                error: `Khong tim thay hoc sinh: ${studentEmail || studentName}`,
              });
            }
            studentId = student.id;
          }

          // Get student info
          const student = await this.prisma.user.findUnique({
            where: { id: studentId },
            select: { id: true, displayName: true, email: true, phone: true },
          });

          if (!student) {
            return JSON.stringify({ success: false, error: 'Khong tim thay hoc sinh' });
          }

          // Get all transactions
          const transactions = await this.prisma.transaction.findMany({
            where: { studentId },
            include: {
              course: {
                select: { id: true, title: true, price: true },
              },
              classroom: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          });

          // Get enrolled classrooms (to check active courses)
          const enrollments = await this.prisma.classroomStudent.findMany({
            where: { studentId, isActive: true },
            include: {
              classroom: {
                include: {
                  course: {
                    select: { id: true, title: true, price: true },
                  },
                },
              },
            },
          });

          // Categorize transactions
          const successTransactions = transactions.filter((t) => t.status === 'success');
          const pendingTransactions = transactions.filter((t) => t.status === 'pending');
          const failedTransactions = transactions.filter((t) => t.status === 'failed');

          // Calculate totals
          const totalPaid = successTransactions.reduce((s, t) => s + t.amount, 0);
          const totalPending = pendingTransactions.reduce((s, t) => s + t.amount, 0);

          // Purchased courses
          const purchasedCourses = successTransactions
            .filter((t) => t.course)
            .map((t) => ({
              courseId: t.course!.id,
              courseTitle: t.course!.title,
              amount: t.amount,
              purchasedAt: t.completedAt || t.createdAt,
            }));

          // Active enrollments
          const activeEnrollments = enrollments.map((e) => ({
            classroomId: e.classroomId,
            classroomName: e.classroom.name,
            courseName: e.classroom.course?.title,
            joinedAt: e.joinedAt,
          }));

          // Recent transactions
          const recentTransactions = transactions.slice(0, 10).map((t) => ({
            id: t.id,
            amount: t.amount,
            status: t.status,
            type: t.type,
            course: t.course?.title,
            createdAt: t.createdAt,
          }));

          return JSON.stringify({
            success: true,
            student: {
              id: student.id,
              name: student.displayName,
              email: student.email,
              phone: student.phone,
            },
            summary: {
              totalPaid,
              totalPending,
              successCount: successTransactions.length,
              pendingCount: pendingTransactions.length,
              failedCount: failedTransactions.length,
              activeCoursesCount: activeEnrollments.length,
            },
            purchasedCourses,
            activeEnrollments,
            pendingTransactions: pendingTransactions.map((t) => ({
              id: t.id,
              amount: t.amount,
              course: t.course?.title,
              createdAt: t.createdAt,
            })),
            recentTransactions,
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Student payment status error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: `Loi kiem tra: ${error.message}`,
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
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return start;
  }

  private formatTransaction(t: any) {
    return {
      id: t.id,
      amount: t.amount,
      currency: t.currency,
      type: t.type,
      status: t.status,
      provider: t.provider,
      student: t.student ? {
        id: t.student.id,
        name: t.student.displayName,
        email: t.student.email,
        phone: t.student.phone,
      } : null,
      course: t.course?.title,
      classroom: t.classroom?.name,
      vnpayTxnRef: t.vnpayTxnRef,
      createdAt: t.createdAt,
    };
  }

  private formatAge(minutes: number): string {
    if (minutes < 60) return `${minutes} phut`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} gio`;
    const days = Math.floor(hours / 24);
    return `${days} ngay`;
  }

  private async generateRevenueInsights(data: {
    totalRevenue: number;
    totalTransactions: number;
    avgTransactionValue: number;
    topCourse: any;
    trend: any[];
  }) {
    const prompt = `Phan tich doanh thu:

**Tong quan:**
- Tong doanh thu: ${data.totalRevenue.toLocaleString()} VND
- So giao dich: ${data.totalTransactions}
- Gia tri TB: ${data.avgTransactionValue.toLocaleString()} VND
- Khoa hoc ban chay nhat: ${data.topCourse?.courseTitle || 'N/A'} (${data.topCourse?.amount?.toLocaleString() || 0} VND)

**Xu huong:** ${data.trend.length > 1 ?
  (data.trend[data.trend.length - 1].amount > data.trend[0].amount ? 'Tang' : 'Giam')
  : 'Chua du du lieu'}

Dua ra 2-3 insights ngan gon va 1-2 goi y.

Format JSON:
{
  "insights": ["...", "..."],
  "suggestions": ["..."]
}`;

    try {
      const response = await this.gemini.generateResponse(prompt);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return {
        insights: [
          `Tong doanh thu dat ${data.totalRevenue.toLocaleString()} VND tu ${data.totalTransactions} giao dich`,
        ],
        suggestions: ['Tiep tuc theo doi xu huong doanh thu'],
      };
    }
  }
}
