import { PrismaRepository } from '@app/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * StudentAlertTool - Cong cu phat hien va canh bao hoc sinh can ho tro
 *
 * Features:
 * - Phat hien hoc sinh co diem thap
 * - Phat hien hoc sinh vang mat nhieu
 * - Phat hien hoc sinh khong hoat dong
 * - Phat hien hoc sinh nop bai tre
 * - AI recommendations cho tung truong hop
 */
@Injectable()
export class StudentAlertTool {
  private readonly logger = new Logger(StudentAlertTool.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly prisma: PrismaRepository) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'detect_student_alerts',
      description: `Phat hien hoc sinh can ho tro hoac can thiep. Su dung khi:
- "hoc sinh nao can ho tro", "ai can giup do"
- "canh bao hoc sinh", "student alerts"
- "hoc sinh co van de", "at-risk students"
- "hoc sinh diem thap", "hoc sinh vang nhieu"
- "ai khong hoat dong", "inactive students"
OUTPUT: Danh sach canh bao theo muc do uu tien voi goi y hanh dong.`,
      schema: z.object({
        teacherId: z.string().optional().describe('ID giao vien'),
        classroomId: z.string().optional().describe('ID lop hoc'),
        period: z
          .enum(['7d', '30d', '90d'])
          .optional()
          .default('30d')
          .describe('Khoang thoi gian'),
        alertTypes: z
          .array(
            z.enum([
              'low_score',
              'low_attendance',
              'inactive',
              'late_submissions',
              'all',
            ]),
          )
          .optional()
          .default(['all'])
          .describe('Loai canh bao'),
      }),
      func: async ({
        teacherId,
        classroomId,
        period = '30d',
        alertTypes = ['all'],
      }) => {
        return this._call(
          JSON.stringify({ teacherId, classroomId, period, alertTypes }),
        );
      },
    });
  }

  private async _call(input: string): Promise<string> {
    try {
      this.logger.log(`Student Alert Tool called: ${input}`);

      let params: {
        teacherId?: string;
        classroomId?: string;
        period?: string;
        alertTypes?: string[];
      } = {};

      try {
        params = JSON.parse(input);
      } catch {
        params = { period: '30d', alertTypes: ['all'] };
      }

      const period = params.period || '30d';
      const alertTypes = params.alertTypes || ['all'];
      const checkAll = alertTypes.includes('all');

      const dateFilter = this.getDateFilter(period);

      // Get students to check
      const studentIds = await this.getStudentIds(params);

      if (studentIds.length === 0) {
        return JSON.stringify({
          success: true,
          message: 'Không tìm thấy học sinh nào để kiểm tra.',
          alerts: [],
        });
      }

      const alerts: any[] = [];

      // 1. Check low scores
      if (checkAll || alertTypes.includes('low_score')) {
        const lowScoreAlerts = await this.checkLowScores(
          studentIds,
          dateFilter,
        );
        alerts.push(...lowScoreAlerts);
      }

      // 2. Check low attendance
      if (checkAll || alertTypes.includes('low_attendance')) {
        const attendanceAlerts = await this.checkLowAttendance(
          studentIds,
          dateFilter,
          params.classroomId,
        );
        alerts.push(...attendanceAlerts);
      }

      // 3. Check inactive students
      if (checkAll || alertTypes.includes('inactive')) {
        const inactiveAlerts = await this.checkInactive(studentIds, dateFilter);
        alerts.push(...inactiveAlerts);
      }

      // 4. Check late submissions
      if (checkAll || alertTypes.includes('late_submissions')) {
        const lateAlerts = await this.checkLateSubmissions(
          studentIds,
          dateFilter,
        );
        alerts.push(...lateAlerts);
      }

      // Sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      alerts.sort(
        (a, b) =>
          (priorityOrder[a.priority as keyof typeof priorityOrder] || 4) -
          (priorityOrder[b.priority as keyof typeof priorityOrder] || 4),
      );

      // Generate summary
      const critical = alerts.filter((a) => a.priority === 'critical').length;
      const high = alerts.filter((a) => a.priority === 'high').length;
      const medium = alerts.filter((a) => a.priority === 'medium').length;

      let summaryMessage = '';
      if (critical > 0) {
        summaryMessage = `🚨 Có ${critical} cảnh báo CRITICAL cần xử lý ngay!`;
      } else if (high > 0) {
        summaryMessage = `Có ${high} cảnh báo HIGH cần chú ý.`;
      } else if (medium > 0) {
        summaryMessage = `Có ${medium} cảnh báo cần theo dõi.`;
      } else if (alerts.length > 0) {
        summaryMessage = `Có ${alerts.length} lưu ý nhỏ.`;
      } else {
        summaryMessage = 'Tất cả học sinh đang hoạt động tốt!';
      }

      // Get AI recommendations if there are critical alerts
      let aiRecommendations = null;
      if (critical > 0 || high > 0) {
        aiRecommendations = await this.getAIRecommendations(
          alerts.filter(
            (a) => a.priority === 'critical' || a.priority === 'high',
          ),
        );
      }

      return JSON.stringify({
        success: true,
        summary: {
          message: summaryMessage,
          totalAlerts: alerts.length,
          bySeverity: {
            critical,
            high,
            medium,
            low: alerts.filter((a) => a.priority === 'low').length,
          },
          byType: {
            lowScore: alerts.filter((a) => a.type === 'low_score').length,
            lowAttendance: alerts.filter((a) => a.type === 'low_attendance')
              .length,
            inactive: alerts.filter((a) => a.type === 'inactive').length,
            lateSubmissions: alerts.filter((a) => a.type === 'late_submissions')
              .length,
          },
        },
        alerts: alerts.slice(0, 20), // Limit to 20 alerts
        aiRecommendations,
        period,
      });
    } catch (error) {
      this.logger.error('Student Alert error:', error);
      return JSON.stringify({
        success: false,
        error: 'Lỗi khi phát hiện cảnh báo: ' + (error as Error).message,
      });
    }
  }

  private getDateFilter(period: string): Date {
    const now = new Date();
    switch (period) {
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      case '90d':
        return new Date(now.setDate(now.getDate() - 90));
      default:
        return new Date(now.setDate(now.getDate() - 30));
    }
  }

  private async getStudentIds(params: {
    teacherId?: string;
    classroomId?: string;
  }): Promise<string[]> {
    if (params.classroomId) {
      const students = await this.prisma.classroomStudent.findMany({
        where: { classroomId: params.classroomId, isActive: true },
        select: { studentId: true },
      });
      return students.map((s) => s.studentId);
    }

    if (params.teacherId) {
      const classrooms = await this.prisma.classroom.findMany({
        where: { teacherId: params.teacherId, isActive: true },
        include: {
          students: {
            where: { isActive: true },
            select: { studentId: true },
          },
        },
      });
      const studentIds = new Set<string>();
      classrooms.forEach((c) => {
        c.students.forEach((s) => studentIds.add(s.studentId));
      });
      return Array.from(studentIds);
    }

    // Get all active students
    const students = await this.prisma.classroomStudent.findMany({
      where: { isActive: true },
      select: { studentId: true },
      distinct: ['studentId'],
      take: 500, // Limit
    });
    return students.map((s) => s.studentId);
  }

  private async checkLowScores(
    studentIds: string[],
    dateFilter: Date,
  ): Promise<any[]> {
    const alerts: any[] = [];

    // Get submissions grouped by student
    const submissions = await this.prisma.assignmentSubmission.findMany({
      where: {
        studentId: { in: studentIds },
        submittedAt: { gte: dateFilter },
        score: { not: null },
      },
      include: {
        student: {
          select: { id: true, displayName: true, email: true },
        },
        assignment: {
          select: { totalPoints: true, classroom: { select: { name: true } } },
        },
      },
    });

    // Group by student
    const byStudent = new Map<string, any[]>();
    submissions.forEach((s) => {
      if (!byStudent.has(s.studentId)) {
        byStudent.set(s.studentId, []);
      }
      byStudent.get(s.studentId)!.push(s);
    });

    // Check each student
    byStudent.forEach((subs, studentId) => {
      const avgPercent =
        subs.reduce((sum, s) => {
          const percent = ((s.score || 0) / s.assignment.totalPoints) * 100;
          return sum + percent;
        }, 0) / subs.length;

      if (avgPercent < 40) {
        alerts.push({
          type: 'low_score',
          priority: 'critical',
          priorityEmoji: '🚨',
          studentId,
          studentName:
            subs[0].student.displayName || subs[0].student.email || 'N/A',
          message: `Điểm TB rất thấp: ${avgPercent.toFixed(1)}%`,
          details: {
            avgScore: avgPercent.toFixed(1),
            totalSubmissions: subs.length,
            classroom: subs[0].assignment.classroom?.name,
          },
          action: 'Cần gặp riêng học sinh để hỗ trợ học tập',
        });
      } else if (avgPercent < 60) {
        alerts.push({
          type: 'low_score',
          priority: 'high',
          priorityEmoji: '⚠️',
          studentId,
          studentName:
            subs[0].student.displayName || subs[0].student.email || 'N/A',
          message: `Điểm TB thấp: ${avgPercent.toFixed(1)}%`,
          details: {
            avgScore: avgPercent.toFixed(1),
            totalSubmissions: subs.length,
          },
          action: 'Theo dõi và hỗ trợ thêm bài tập',
        });
      }
    });

    return alerts;
  }

  private async checkLowAttendance(
    studentIds: string[],
    dateFilter: Date,
    classroomId?: string,
  ): Promise<any[]> {
    const alerts: any[] = [];

    // Get attendance records
    const sessions = await this.prisma.classroomSession.findMany({
      where: {
        startTime: { gte: dateFilter },
        ...(classroomId && { classroomId }),
      },
      include: {
        attendance: {
          where: { studentId: { in: studentIds } },
        },
        classroom: { select: { name: true } },
      },
    });

    // Group by student
    const byStudent = new Map<
      string,
      { present: number; total: number; classroom: string }
    >();

    sessions.forEach((session) => {
      session.attendance.forEach((a) => {
        if (!byStudent.has(a.studentId)) {
          byStudent.set(a.studentId, {
            present: 0,
            total: 0,
            classroom: session.classroom?.name || 'N/A',
          });
        }
        const data = byStudent.get(a.studentId)!;
        data.total++;
        if (a.status === 'present') {
          data.present++;
        }
      });
    });

    // Check attendance rate
    for (const [studentId, data] of byStudent) {
      if (data.total === 0) continue;

      const rate = (data.present / data.total) * 100;

      if (rate < 50) {
        const student = await this.prisma.user.findUnique({
          where: { id: studentId },
          select: { displayName: true, email: true },
        });

        alerts.push({
          type: 'low_attendance',
          priority: 'critical',
          priorityEmoji: '🚨',
          studentId,
          studentName: student?.displayName || student?.email || 'N/A',
          message: `Tỷ lệ đi học rất thấp: ${rate.toFixed(1)}%`,
          details: {
            attendanceRate: rate.toFixed(1),
            present: data.present,
            total: data.total,
            classroom: data.classroom,
          },
          action: 'Liên hệ phụ huynh ngay',
        });
      } else if (rate < 70) {
        const student = await this.prisma.user.findUnique({
          where: { id: studentId },
          select: { displayName: true, email: true },
        });

        alerts.push({
          type: 'low_attendance',
          priority: 'high',
          priorityEmoji: '⚠️',
          studentId,
          studentName: student?.displayName || student?.email || 'N/A',
          message: `Tỷ lệ đi học thấp: ${rate.toFixed(1)}%`,
          details: {
            attendanceRate: rate.toFixed(1),
            present: data.present,
            total: data.total,
          },
          action: 'Nhắc nhở học sinh đi học đều hơn',
        });
      }
    }

    return alerts;
  }

  private async checkInactive(
    studentIds: string[],
    dateFilter: Date,
  ): Promise<any[]> {
    const alerts: any[] = [];

    // Check last activity for each student
    for (const studentId of studentIds.slice(0, 100)) {
      // Limit to avoid timeout
      const lastProgress = await this.prisma.progress.findFirst({
        where: { userId: studentId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      });

      const lastSubmission = await this.prisma.assignmentSubmission.findFirst({
        where: { studentId },
        orderBy: { submittedAt: 'desc' },
        select: { submittedAt: true },
      });

      const lastActivity =
        lastProgress?.updatedAt || lastSubmission?.submittedAt;

      if (!lastActivity || lastActivity < dateFilter) {
        const student = await this.prisma.user.findUnique({
          where: { id: studentId },
          select: { displayName: true, email: true },
        });

        const daysSinceActivity = lastActivity
          ? Math.floor(
              (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
            )
          : 999;

        if (daysSinceActivity > 14) {
          alerts.push({
            type: 'inactive',
            priority: daysSinceActivity > 30 ? 'high' : 'medium',
            priorityEmoji: daysSinceActivity > 30 ? '⚠️' : '📋',
            studentId,
            studentName: student?.displayName || student?.email || 'N/A',
            message: `Không hoạt động ${daysSinceActivity} ngày`,
            details: {
              daysSinceActivity,
              lastActivity: lastActivity?.toISOString() || 'Chưa có',
            },
            action:
              daysSinceActivity > 30
                ? 'Liên hệ học sinh hoặc phụ huynh'
                : 'Nhắc nhở học sinh quay lại học',
          });
        }
      }
    }

    return alerts;
  }

  private async checkLateSubmissions(
    studentIds: string[],
    dateFilter: Date,
  ): Promise<any[]> {
    const alerts: any[] = [];

    // Get late submissions
    const lateSubmissions = await this.prisma.assignmentSubmission.findMany({
      where: {
        studentId: { in: studentIds },
        submittedAt: { gte: dateFilter },
        isLate: true,
      },
      include: {
        student: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    // Group by student
    const byStudent = new Map<string, number>();
    lateSubmissions.forEach((s) => {
      byStudent.set(s.studentId, (byStudent.get(s.studentId) || 0) + 1);
    });

    // Check late count
    for (const [studentId, lateCount] of byStudent) {
      if (lateCount >= 5) {
        const student = lateSubmissions.find(
          (s) => s.studentId === studentId,
        )?.student;

        alerts.push({
          type: 'late_submissions',
          priority: lateCount >= 10 ? 'high' : 'medium',
          priorityEmoji: lateCount >= 10 ? '⚠️' : '📋',
          studentId,
          studentName: student?.displayName || student?.email || 'N/A',
          message: `Nộp trễ ${lateCount} bài`,
          details: { lateCount },
          action: 'Nhắc nhở quản lý thời gian tốt hơn',
        });
      }
    }

    return alerts;
  }

  private async getAIRecommendations(criticalAlerts: any[]): Promise<any> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const prompt = `Phân tích các cảnh báo học sinh cần hỗ trợ và đưa ra gợi ý:

${JSON.stringify(criticalAlerts.slice(0, 5), null, 2)}

Trả về JSON:
{
  "summary": "Tóm tắt tình hình",
  "immediateActions": ["Hành động cần làm ngay"],
  "preventionTips": ["Cách phòng ngừa"],
  "communicationTemplate": "Mẫu tin nhắn gửi phụ huynh"
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (error) {
      this.logger.error('AI recommendations error:', error);
      return null;
    }
  }
}
