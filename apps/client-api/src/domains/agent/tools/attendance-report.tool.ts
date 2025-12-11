import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * Attendance Report Tool
 *
 * Provides comprehensive attendance analytics for classrooms, students, and teachers.
 * Generates insights, trends, and actionable recommendations.
 */
@Injectable()
export class AttendanceReportTool {
  private readonly logger = new Logger(AttendanceReportTool.name);

  constructor(
    private prisma: PrismaRepository,
    private gemini: GeminiService,
  ) {}

  /**
   * Returns array of attendance-related tools
   */
  getTools(): DynamicStructuredTool[] {
    return [
      this.getClassroomAttendanceTool(),
      this.getStudentAttendanceTool(),
      this.getAttendanceTrendsTool(),
      this.getLowAttendanceAlertTool(),
    ];
  }

  /**
   * Tool 1: Get classroom attendance report
   * Analyzes attendance for a specific classroom
   */
  private getClassroomAttendanceTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'classroom_attendance_report',
      description: `Bao cao diem danh chi tiet cho mot lop hoc cu the.

Su dung tool nay khi:
- Nguoi dung hoi "bao cao diem danh lop X"
- Nguoi dung hoi "ty le di hoc cua lop Y"
- Nguoi dung muon xem thong ke diem danh theo lop
- Nguoi dung hoi "co bao nhieu hoc sinh nghi hoc nhieu"

Ket qua tra ve:
- Thong tin lop hoc
- Ty le diem danh trung binh
- Thong ke theo trang thai (co mat, vang, tre, co phep)
- Bang xep hang hoc sinh theo ty le di hoc
- Bieu do thong ke
- Phan tich AI va goi y`,
      schema: z.object({
        classroomId: z.string().optional().describe('UUID cua lop hoc'),
        classroomName: z.string().optional().describe('Ten lop de tim kiem'),
        fromDate: z.string().optional().describe('Ngay bat dau (YYYY-MM-DD)'),
        toDate: z.string().optional().describe('Ngay ket thuc (YYYY-MM-DD)'),
        includeCharts: z
          .boolean()
          .optional()
          .default(true)
          .describe('Co tao bieu do khong'),
      }),
      func: async ({
        classroomId,
        classroomName,
        fromDate,
        toDate,
        includeCharts = true,
      }) => {
        try {
          this.logger.log(
            `Classroom attendance report: ${classroomId || classroomName}`,
          );

          // Find classroom if only name provided
          if (!classroomId && classroomName) {
            const classroom = await this.prisma.classroom.findFirst({
              where: {
                name: { contains: classroomName, mode: 'insensitive' },
              },
            });
            if (!classroom) {
              return JSON.stringify({
                success: false,
                error: `Khong tim thay lop hoc: ${classroomName}`,
              });
            }
            classroomId = classroom.id;
          }

          if (!classroomId) {
            return JSON.stringify({
              success: false,
              error: 'Vui long cung cap classroomId hoac classroomName',
            });
          }

          // Get classroom with sessions and attendance
          const classroom = await this.prisma.classroom.findUnique({
            where: { id: classroomId },
            include: {
              course: { select: { title: true } },
              teacher: { select: { id: true, displayName: true, email: true } },
              students: {
                where: { isActive: true },
                include: {
                  student: {
                    select: { id: true, displayName: true, email: true },
                  },
                },
              },
            },
          });

          if (!classroom) {
            return JSON.stringify({
              success: false,
              error: 'Khong tim thay lop hoc',
            });
          }

          // Build date filter
          const dateFilter: any = {};
          if (fromDate) dateFilter.gte = new Date(fromDate);
          if (toDate) dateFilter.lte = new Date(toDate);

          // Get sessions with attendance
          const sessions = await this.prisma.classroomSession.findMany({
            where: {
              classroomId,
              ...(Object.keys(dateFilter).length > 0
                ? { startTime: dateFilter }
                : {}),
            },
            include: {
              attendance: {
                include: {
                  student: {
                    select: { id: true, displayName: true },
                  },
                },
              },
            },
            orderBy: { startTime: 'desc' },
          });

          const totalSessions = sessions.length;
          const totalStudents = classroom.students.length;

          // Aggregate attendance stats
          const statusCounts = { present: 0, absent: 0, late: 0, excused: 0 };
          const studentStats = new Map<
            string,
            {
              studentId: string;
              studentName: string;
              present: number;
              absent: number;
              late: number;
              excused: number;
              total: number;
            }
          >();

          // Initialize student stats
          classroom.students.forEach((cs) => {
            studentStats.set(cs.studentId, {
              studentId: cs.studentId,
              studentName: cs.student.displayName || 'Unknown',
              present: 0,
              absent: 0,
              late: 0,
              excused: 0,
              total: 0,
            });
          });

          // Aggregate data
          sessions.forEach((session) => {
            session.attendance.forEach((att) => {
              const status = att.status as keyof typeof statusCounts;
              if (status in statusCounts) {
                statusCounts[status]++;
              }

              const stats = studentStats.get(att.studentId);
              if (stats && status in stats) {
                stats[status as 'present' | 'absent' | 'late' | 'excused']++;
                stats.total++;
              }
            });
          });

          // Calculate rates
          const totalAttendanceRecords = Object.values(statusCounts).reduce(
            (a, b) => a + b,
            0,
          );
          const attendedCount = statusCounts.present + statusCounts.late;
          const overallAttendanceRate =
            totalAttendanceRecords > 0
              ? Math.round((attendedCount / totalAttendanceRecords) * 100)
              : 0;

          // Student ranking
          const studentRanking = Array.from(studentStats.values())
            .map((s) => {
              const attended = s.present + s.late;
              const rate =
                totalSessions > 0
                  ? Math.round((attended / totalSessions) * 100)
                  : 0;
              return { ...s, attendanceRate: rate };
            })
            .sort((a, b) => b.attendanceRate - a.attendanceRate);

          // Recent sessions
          const recentSessions = sessions.slice(0, 10).map((s) => ({
            sessionId: s.id,
            title: s.title || `Buoi ${s.sessionNumber}`,
            date: s.startTime,
            present: s.attendance.filter((a) => a.status === 'present').length,
            absent: s.attendance.filter((a) => a.status === 'absent').length,
            late: s.attendance.filter((a) => a.status === 'late').length,
            excused: s.attendance.filter((a) => a.status === 'excused').length,
            total: s.attendance.length,
          }));

          // Generate AI analysis
          const aiAnalysis = await this.analyzeClassroomAttendance({
            classroomName: classroom.name,
            totalSessions,
            totalStudents,
            overallAttendanceRate,
            statusCounts,
            lowAttendanceStudents: studentRanking.filter(
              (s) => s.attendanceRate < 70,
            ),
          });

          // Generate charts
          const charts: any[] = [];
          if (includeCharts) {
            // Chart 1: Attendance status distribution
            charts.push({
              type: 'chart',
              chartType: 'pie',
              title: 'Phan bo trang thai diem danh',
              data: [
                { name: 'Co mat', value: statusCounts.present },
                { name: 'Vang', value: statusCounts.absent },
                { name: 'Di tre', value: statusCounts.late },
                { name: 'Co phep', value: statusCounts.excused },
              ],
              config: {
                colors: ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'],
                legend: true,
              },
            });

            // Chart 2: Student attendance ranking
            if (studentRanking.length > 0) {
              charts.push({
                type: 'chart',
                chartType: 'bar',
                title: 'Ty le di hoc theo hoc sinh',
                data: studentRanking.slice(0, 10).map((s) => ({
                  name: s.studentName.substring(0, 12),
                  value: s.attendanceRate,
                })),
                config: {
                  xLabel: 'Hoc sinh',
                  yLabel: 'Ty le (%)',
                  colors: ['#3b82f6'],
                },
              });
            }

            // Chart 3: Attendance trend by session
            if (recentSessions.length > 0) {
              charts.push({
                type: 'chart',
                chartType: 'line',
                title: 'Xu huong diem danh theo buoi',
                data: recentSessions.reverse().map((s) => ({
                  name: new Date(s.date).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                  }),
                  value:
                    s.total > 0
                      ? Math.round(((s.present + s.late) / s.total) * 100)
                      : 0,
                })),
                config: {
                  xLabel: 'Ngay',
                  yLabel: 'Ty le (%)',
                  colors: ['#10b981'],
                },
              });
            }
          }

          return JSON.stringify({
            success: true,
            classroom: {
              id: classroom.id,
              name: classroom.name,
              course: classroom.course?.title,
              teacher: classroom.teacher?.displayName,
              status: classroom.status,
            },
            summary: {
              totalSessions,
              totalStudents,
              overallAttendanceRate,
              statusBreakdown: statusCounts,
            },
            studentRanking: studentRanking.slice(0, 20),
            recentSessions,
            lowAttendanceStudents: studentRanking.filter(
              (s) => s.attendanceRate < 70,
            ),
            aiInsights: aiAnalysis.insights,
            recommendations: aiAnalysis.recommendations,
            charts,
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Classroom attendance error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: `Loi tao bao cao: ${error.message}`,
          });
        }
      },
    });
  }

  /**
   * Tool 2: Get individual student attendance
   * Analyzes attendance history for a specific student
   */
  private getStudentAttendanceTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'student_attendance_history',
      description: `Lich su diem danh chi tiet cua mot hoc sinh.

Su dung tool nay khi:
- Nguoi dung hoi "hoc sinh X di hoc the nao"
- Nguoi dung hoi "ty le di hoc cua email abc@gmail.com"
- Nguoi dung muon xem thong ke diem danh cua hoc sinh cu the
- Phu huynh hoi ve tinh hinh di hoc cua con

Ket qua tra ve:
- Thong tin hoc sinh
- Ty le diem danh tong the va theo tung lop
- Lich su chi tiet cac buoi hoc
- Phan tich xu huong va canh bao`,
      schema: z.object({
        studentId: z.string().optional().describe('UUID cua hoc sinh'),
        studentEmail: z.string().optional().describe('Email hoc sinh'),
        studentName: z.string().optional().describe('Ten hoc sinh de tim'),
        classroomId: z
          .string()
          .optional()
          .describe('Gioi han trong lop cu the'),
        limit: z.number().optional().default(50).describe('So ban ghi toi da'),
      }),
      func: async ({
        studentId,
        studentEmail,
        studentName,
        classroomId,
        limit = 50,
      }) => {
        try {
          this.logger.log(
            `Student attendance: ${studentId || studentEmail || studentName}`,
          );

          // Find student
          if (!studentId) {
            const whereClause: any = { role: 'student' };
            if (studentEmail) {
              whereClause.email = {
                contains: studentEmail,
                mode: 'insensitive',
              };
            } else if (studentName) {
              whereClause.OR = [
                { displayName: { contains: studentName, mode: 'insensitive' } },
                { firstName: { contains: studentName, mode: 'insensitive' } },
                { lastName: { contains: studentName, mode: 'insensitive' } },
              ];
            }

            const student = await this.prisma.user.findFirst({
              where: whereClause,
            });
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
            return JSON.stringify({
              success: false,
              error: 'Khong tim thay hoc sinh',
            });
          }

          // Get enrolled classrooms
          const enrollments = await this.prisma.classroomStudent.findMany({
            where: {
              studentId,
              isActive: true,
              ...(classroomId ? { classroomId } : {}),
            },
            include: {
              classroom: {
                select: { id: true, name: true, status: true },
              },
            },
          });

          // Get attendance records
          const attendanceWhere: any = { studentId };
          if (classroomId) {
            attendanceWhere.session = { classroomId };
          }

          const attendanceRecords =
            await this.prisma.sessionAttendance.findMany({
              where: attendanceWhere,
              include: {
                session: {
                  select: {
                    id: true,
                    title: true,
                    sessionNumber: true,
                    startTime: true,
                    classroom: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
              orderBy: { session: { startTime: 'desc' } },
              take: limit,
            });

          // Aggregate stats
          const overallStats = {
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            total: 0,
          };
          const classroomStats = new Map<
            string,
            {
              classroomId: string;
              classroomName: string;
              present: number;
              absent: number;
              late: number;
              excused: number;
              total: number;
            }
          >();

          attendanceRecords.forEach((att) => {
            const status = att.status as keyof typeof overallStats;
            if (status in overallStats) {
              overallStats[status]++;
            }
            overallStats.total++;

            const cId = att.session.classroom.id;
            if (!classroomStats.has(cId)) {
              classroomStats.set(cId, {
                classroomId: cId,
                classroomName: att.session.classroom.name,
                present: 0,
                absent: 0,
                late: 0,
                excused: 0,
                total: 0,
              });
            }
            const cStats = classroomStats.get(cId)!;
            if (status in cStats) {
              cStats[status as 'present' | 'absent' | 'late' | 'excused']++;
            }
            cStats.total++;
          });

          // Calculate rates
          const attended = overallStats.present + overallStats.late;
          const overallRate =
            overallStats.total > 0
              ? Math.round((attended / overallStats.total) * 100)
              : 0;

          const classroomBreakdown = Array.from(classroomStats.values()).map(
            (c) => ({
              ...c,
              attendanceRate:
                c.total > 0
                  ? Math.round(((c.present + c.late) / c.total) * 100)
                  : 0,
            }),
          );

          // Recent history
          const recentHistory = attendanceRecords.slice(0, 20).map((att) => ({
            date: att.session.startTime,
            sessionTitle:
              att.session.title || `Buoi ${att.session.sessionNumber}`,
            classroomName: att.session.classroom.name,
            status: att.status,
            checkInTime: att.checkInTime,
            notes: att.notes,
          }));

          // Identify patterns
          const absentStreak = this.calculateAbsentStreak(attendanceRecords);
          const recentTrend = this.calculateRecentTrend(
            attendanceRecords.slice(0, 10),
          );

          return JSON.stringify({
            success: true,
            student: {
              id: student.id,
              name: student.displayName,
              email: student.email,
            },
            enrolledClasses: enrollments.length,
            overallStats: {
              ...overallStats,
              attendanceRate: overallRate,
            },
            classroomBreakdown,
            recentHistory,
            patterns: {
              currentAbsentStreak: absentStreak,
              recentTrend,
              isAtRisk: overallRate < 70 || absentStreak >= 3,
            },
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Student attendance error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: `Loi truy van: ${error.message}`,
          });
        }
      },
    });
  }

  /**
   * Tool 3: Get attendance trends across the system
   * Provides system-wide or filtered attendance analytics
   */
  private getAttendanceTrendsTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'attendance_trends',
      description: `Phan tich xu huong diem danh toan he thong hoac theo bo loc.

Su dung tool nay khi:
- Nguoi dung hoi "xu huong diem danh thang nay"
- Nguoi dung hoi "so sanh diem danh giua cac lop"
- Nguoi dung muon xem tong quan diem danh toan truong
- Phan tich theo thoi gian, khoa hoc, giao vien

Ket qua tra ve:
- Ty le diem danh trung binh theo thoi gian
- So sanh giua cac lop/khoa hoc
- Xu huong tang/giam
- Bieu do phan tich`,
      schema: z.object({
        period: z
          .enum(['week', 'month', 'quarter', 'year'])
          .optional()
          .default('month'),
        groupBy: z
          .enum(['classroom', 'course', 'teacher', 'day'])
          .optional()
          .default('classroom'),
        courseId: z.string().optional().describe('Loc theo khoa hoc'),
        teacherId: z.string().optional().describe('Loc theo giao vien'),
        includeCharts: z.boolean().optional().default(true),
      }),
      func: async ({
        period = 'month',
        groupBy = 'classroom',
        courseId,
        teacherId,
        includeCharts = true,
      }) => {
        try {
          this.logger.log(
            `Attendance trends: period=${period}, groupBy=${groupBy}`,
          );

          const startDate = this.getStartDate(period);

          // Build classroom filter
          const classroomWhere: any = {};
          if (courseId) classroomWhere.courseId = courseId;
          if (teacherId) classroomWhere.teacherId = teacherId;

          // Get sessions with attendance
          const sessions = await this.prisma.classroomSession.findMany({
            where: {
              startTime: { gte: startDate },
              ...(Object.keys(classroomWhere).length > 0
                ? { classroom: classroomWhere }
                : {}),
            },
            include: {
              classroom: {
                select: {
                  id: true,
                  name: true,
                  course: { select: { id: true, title: true } },
                  teacher: { select: { id: true, displayName: true } },
                },
              },
              attendance: {
                select: { status: true },
              },
            },
            orderBy: { startTime: 'asc' },
          });

          const totalSessions = sessions.length;
          let totalAttendance = 0;
          let totalPresent = 0;
          let totalLate = 0;

          // Aggregate by group
          const groupedData = new Map<
            string,
            {
              key: string;
              name: string;
              sessions: number;
              present: number;
              absent: number;
              late: number;
              excused: number;
              total: number;
            }
          >();

          // Daily trend data
          const dailyTrend = new Map<
            string,
            { date: string; attended: number; total: number }
          >();

          sessions.forEach((session) => {
            let groupKey: string;
            let groupName: string;

            switch (groupBy) {
              case 'course':
                groupKey = session.classroom.course?.id || 'unknown';
                groupName = session.classroom.course?.title || 'Unknown Course';
                break;
              case 'teacher':
                groupKey = session.classroom.teacher?.id || 'unknown';
                groupName =
                  session.classroom.teacher?.displayName || 'Unknown Teacher';
                break;
              case 'day':
                groupKey = session.startTime.toISOString().split('T')[0];
                groupName = groupKey;
                break;
              default:
                groupKey = session.classroom.id;
                groupName = session.classroom.name;
            }

            if (!groupedData.has(groupKey)) {
              groupedData.set(groupKey, {
                key: groupKey,
                name: groupName,
                sessions: 0,
                present: 0,
                absent: 0,
                late: 0,
                excused: 0,
                total: 0,
              });
            }

            const group = groupedData.get(groupKey)!;
            group.sessions++;

            session.attendance.forEach((att) => {
              const status = att.status;
              totalAttendance++;
              group.total++;

              if (status === 'present') {
                totalPresent++;
                group.present++;
              } else if (status === 'late') {
                totalLate++;
                group.late++;
              } else if (status === 'absent') {
                group.absent++;
              } else if (status === 'excused') {
                group.excused++;
              }
            });

            // Daily aggregation
            const dateKey = session.startTime.toISOString().split('T')[0];
            if (!dailyTrend.has(dateKey)) {
              dailyTrend.set(dateKey, { date: dateKey, attended: 0, total: 0 });
            }
            const daily = dailyTrend.get(dateKey)!;
            session.attendance.forEach((att) => {
              daily.total++;
              if (att.status === 'present' || att.status === 'late') {
                daily.attended++;
              }
            });
          });

          const overallRate =
            totalAttendance > 0
              ? Math.round(((totalPresent + totalLate) / totalAttendance) * 100)
              : 0;

          const groupedResults = Array.from(groupedData.values())
            .map((g) => ({
              ...g,
              attendanceRate:
                g.total > 0
                  ? Math.round(((g.present + g.late) / g.total) * 100)
                  : 0,
            }))
            .sort((a, b) => b.attendanceRate - a.attendanceRate);

          const dailyResults = Array.from(dailyTrend.values())
            .map((d) => ({
              ...d,
              attendanceRate:
                d.total > 0 ? Math.round((d.attended / d.total) * 100) : 0,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

          // Generate charts
          const charts: any[] = [];
          if (includeCharts && groupedResults.length > 0) {
            // Chart 1: Comparison bar chart
            charts.push({
              type: 'chart',
              chartType: 'bar',
              title: `Ty le diem danh theo ${groupBy === 'classroom' ? 'lop' : groupBy === 'course' ? 'khoa hoc' : groupBy === 'teacher' ? 'giao vien' : 'ngay'}`,
              data: groupedResults.slice(0, 10).map((g) => ({
                name: g.name.substring(0, 15),
                value: g.attendanceRate,
              })),
              config: {
                xLabel: groupBy,
                yLabel: 'Ty le (%)',
                colors: ['#3b82f6'],
              },
            });

            // Chart 2: Daily trend line chart
            if (dailyResults.length > 1) {
              charts.push({
                type: 'chart',
                chartType: 'line',
                title: 'Xu huong diem danh theo ngay',
                data: dailyResults.slice(-14).map((d) => ({
                  name: new Date(d.date).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                  }),
                  value: d.attendanceRate,
                })),
                config: {
                  xLabel: 'Ngay',
                  yLabel: 'Ty le (%)',
                  colors: ['#10b981'],
                },
              });
            }
          }

          return JSON.stringify({
            success: true,
            period,
            groupBy,
            summary: {
              totalSessions,
              totalAttendanceRecords: totalAttendance,
              overallAttendanceRate: overallRate,
              groupsAnalyzed: groupedResults.length,
            },
            groupedResults: groupedResults.slice(0, 20),
            dailyTrend: dailyResults.slice(-30),
            charts,
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Attendance trends error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: `Loi phan tich: ${error.message}`,
          });
        }
      },
    });
  }

  /**
   * Tool 4: Get low attendance alerts
   * Identifies students with concerning attendance patterns
   */
  private getLowAttendanceAlertTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'low_attendance_alerts',
      description: `Canh bao hoc sinh co ty le di hoc thap hoac vang nhieu.

Su dung tool nay khi:
- Nguoi dung hoi "hoc sinh nao nghi nhieu"
- Nguoi dung hoi "canh bao diem danh"
- Nguoi dung muon tim hoc sinh can can thiep
- Nguoi dung hoi "ai vang lien tiep"

Ket qua tra ve:
- Danh sach hoc sinh co ty le di hoc thap
- Hoc sinh vang lien tiep nhieu buoi
- Phan loai muc do nghiem trong
- Goi y hanh dong`,
      schema: z.object({
        threshold: z
          .number()
          .optional()
          .default(70)
          .describe('Nguong ty le canh bao (%)'),
        classroomId: z
          .string()
          .optional()
          .describe('Gioi han trong lop cu the'),
        courseId: z.string().optional().describe('Gioi han trong khoa hoc'),
        consecutiveAbsent: z
          .number()
          .optional()
          .default(3)
          .describe('So buoi vang lien tiep'),
      }),
      func: async ({
        threshold = 70,
        classroomId,
        courseId,
        consecutiveAbsent = 3,
      }) => {
        try {
          this.logger.log(
            `Low attendance alerts: threshold=${threshold}%, consecutive=${consecutiveAbsent}`,
          );

          // Build filter
          const classroomWhere: any = { status: 'ongoing' };
          if (classroomId) classroomWhere.id = classroomId;
          if (courseId) classroomWhere.courseId = courseId;

          // Get active classrooms
          const classrooms = await this.prisma.classroom.findMany({
            where: classroomWhere,
            include: {
              students: {
                where: { isActive: true },
                include: {
                  student: {
                    select: { id: true, displayName: true, email: true },
                  },
                },
              },
              sessions: {
                orderBy: { startTime: 'desc' },
                take: 20,
                include: {
                  attendance: true,
                },
              },
            },
          });

          const alerts: Array<{
            studentId: string;
            studentName: string;
            studentEmail: string;
            classroomId: string;
            classroomName: string;
            attendanceRate: number;
            consecutiveAbsences: number;
            totalSessions: number;
            severity: 'critical' | 'warning' | 'watch';
            reason: string;
          }> = [];

          classrooms.forEach((classroom) => {
            const totalSessions = classroom.sessions.length;
            if (totalSessions === 0) return;

            classroom.students.forEach((cs) => {
              const studentId = cs.studentId;
              const studentAttendance = classroom.sessions.flatMap((s) =>
                s.attendance.filter((a) => a.studentId === studentId),
              );

              // Calculate rate
              const attended = studentAttendance.filter(
                (a) => a.status === 'present' || a.status === 'late',
              ).length;
              const rate = Math.round((attended / totalSessions) * 100);

              // Check consecutive absences
              let maxConsecutive = 0;
              let currentStreak = 0;
              classroom.sessions.forEach((session) => {
                const att = session.attendance.find(
                  (a) => a.studentId === studentId,
                );
                if (!att || att.status === 'absent') {
                  currentStreak++;
                  maxConsecutive = Math.max(maxConsecutive, currentStreak);
                } else {
                  currentStreak = 0;
                }
              });

              // Determine if alert needed
              let severity: 'critical' | 'warning' | 'watch' | null = null;
              let reason = '';

              if (rate < 50 || maxConsecutive >= consecutiveAbsent + 2) {
                severity = 'critical';
                reason =
                  rate < 50
                    ? `Ty le di hoc chi ${rate}%`
                    : `Vang ${maxConsecutive} buoi lien tiep`;
              } else if (
                rate < threshold ||
                maxConsecutive >= consecutiveAbsent
              ) {
                severity = 'warning';
                reason =
                  rate < threshold
                    ? `Ty le di hoc ${rate}% (duoi nguong ${threshold}%)`
                    : `Vang ${maxConsecutive} buoi lien tiep`;
              } else if (rate < threshold + 10) {
                severity = 'watch';
                reason = `Ty le di hoc ${rate}% - can theo doi`;
              }

              if (severity) {
                alerts.push({
                  studentId,
                  studentName: cs.student.displayName || 'Unknown',
                  studentEmail: cs.student.email,
                  classroomId: classroom.id,
                  classroomName: classroom.name,
                  attendanceRate: rate,
                  consecutiveAbsences: maxConsecutive,
                  totalSessions,
                  severity,
                  reason,
                });
              }
            });
          });

          // Sort by severity
          const severityOrder = { critical: 0, warning: 1, watch: 2 };
          alerts.sort((a, b) => {
            const sevDiff =
              severityOrder[a.severity] - severityOrder[b.severity];
            if (sevDiff !== 0) return sevDiff;
            return a.attendanceRate - b.attendanceRate;
          });

          const summary = {
            total: alerts.length,
            critical: alerts.filter((a) => a.severity === 'critical').length,
            warning: alerts.filter((a) => a.severity === 'warning').length,
            watch: alerts.filter((a) => a.severity === 'watch').length,
          };

          return JSON.stringify({
            success: true,
            threshold,
            consecutiveAbsentThreshold: consecutiveAbsent,
            summary,
            alerts: alerts.slice(0, 50),
            recommendations: this.generateAlertRecommendations(summary),
            generatedAt: new Date().toISOString(),
          });
        } catch (error) {
          this.logger.error(`Low attendance alerts error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: `Loi tao canh bao: ${error.message}`,
          });
        }
      },
    });
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate current absent streak from attendance records
   */
  private calculateAbsentStreak(records: any[]): number {
    let streak = 0;
    for (const record of records) {
      if (record.status === 'absent') {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  /**
   * Calculate recent attendance trend
   */
  private calculateRecentTrend(
    records: any[],
  ): 'improving' | 'declining' | 'stable' {
    if (records.length < 5) return 'stable';

    const firstHalf = records.slice(0, Math.floor(records.length / 2));
    const secondHalf = records.slice(Math.floor(records.length / 2));

    const firstRate =
      firstHalf.filter((r) => r.status === 'present' || r.status === 'late')
        .length / firstHalf.length;
    const secondRate =
      secondHalf.filter((r) => r.status === 'present' || r.status === 'late')
        .length / secondHalf.length;

    if (secondRate - firstRate > 0.2) return 'improving';
    if (firstRate - secondRate > 0.2) return 'declining';
    return 'stable';
  }

  /**
   * Get start date based on period
   */
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
      default:
        start.setMonth(start.getMonth() - 1);
    }

    return start;
  }

  /**
   * Generate AI analysis for classroom attendance
   */
  private async analyzeClassroomAttendance(data: {
    classroomName: string;
    totalSessions: number;
    totalStudents: number;
    overallAttendanceRate: number;
    statusCounts: {
      present: number;
      absent: number;
      late: number;
      excused: number;
    };
    lowAttendanceStudents: any[];
  }) {
    const prompt = `Phan tich diem danh lop hoc:

**Lop:** ${data.classroomName}
**Tong buoi:** ${data.totalSessions}
**Tong hoc sinh:** ${data.totalStudents}
**Ty le di hoc:** ${data.overallAttendanceRate}%
**Thong ke:** Co mat: ${data.statusCounts.present}, Vang: ${data.statusCounts.absent}, Tre: ${data.statusCounts.late}, Co phep: ${data.statusCounts.excused}
**Hoc sinh ty le thap (<70%):** ${data.lowAttendanceStudents.length} nguoi

Dua ra:
1. 3 insights ve tinh hinh diem danh
2. 3 recommendations de cai thien

Format JSON:
{
  "insights": [{"text": "...", "type": "positive|negative|neutral"}],
  "recommendations": [{"text": "...", "priority": "high|medium|low"}]
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
          {
            text: `Ty le diem danh ${data.overallAttendanceRate}%`,
            type: data.overallAttendanceRate >= 80 ? 'positive' : 'negative',
          },
        ],
        recommendations: [
          { text: 'Theo doi hoc sinh vang nhieu', priority: 'high' },
        ],
      };
    }
  }

  /**
   * Generate recommendations based on alert summary
   */
  private generateAlertRecommendations(summary: {
    total: number;
    critical: number;
    warning: number;
    watch: number;
  }) {
    const recommendations: string[] = [];

    if (summary.critical > 0) {
      recommendations.push(
        `Can lien he ngay ${summary.critical} hoc sinh muc critical`,
      );
      recommendations.push('Thong bao phu huynh ve tinh trang vang hoc');
    }

    if (summary.warning > 0) {
      recommendations.push(
        `Theo doi sat ${summary.warning} hoc sinh muc warning`,
      );
      recommendations.push('Tim hieu nguyen nhan vang hoc');
    }

    if (summary.watch > 0) {
      recommendations.push(`Chu y ${summary.watch} hoc sinh co dau hieu giam`);
    }

    if (summary.total === 0) {
      recommendations.push('Tinh hinh diem danh tot, tiep tuc duy tri');
    }

    return recommendations;
  }
}
