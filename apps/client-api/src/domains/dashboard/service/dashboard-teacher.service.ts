import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { TeacherDashboardDto } from '../dto/dashboard.dto';

@Injectable()
export class DashboardTeacherService {
  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Get teacher dashboard data
   * @param teacherUserId ID của giáo viên
   * @returns Dashboard data cho giáo viên
   */
  async getTeacherDashboardData(
    teacherUserId: string,
  ): Promise<TeacherDashboardDto> {
    // 1. Lấy các lớp học active của giáo viên với số lượng học sinh
    const activeClassrooms = await this.prisma.classroom.findMany({
      where: {
        teacherId: teacherUserId,
        status: 'ongoing',
      },
      select: {
        id: true,
        name: true,
        classCode: true,
        status: true,
        maxStudents: true,
        courseId: true,
      },
    });

    // Lấy thêm thông tin course và đếm students
    const classroomsWithDetails = await Promise.all(
      activeClassrooms.map(async (classroom) => {
        const [course, studentsCount, nextSession] = await Promise.all([
          this.prisma.course.findUnique({
            where: { id: classroom.courseId },
            select: { title: true },
          }),
          this.prisma.classroomStudent.count({
            where: {
              classroomId: classroom.id,
              isActive: true,
            },
          }),
          this.prisma.classroomSession.findFirst({
            where: {
              classroomId: classroom.id,
              startTime: { gte: new Date() },
            },
            orderBy: { startTime: 'asc' },
            select: { startTime: true },
          }),
        ]);

        return {
          ...classroom,
          courseName: course?.title,
          studentsCount,
          nextSessionTime: nextSession?.startTime,
        };
      }),
    );

    // 2. Lấy các buổi học sắp tới trong 24h
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcomingSessions = await this.prisma.classroomSession.findMany({
      where: {
        startTime: {
          gte: now,
          lte: next24Hours,
        },
        classroomId: {
          in: activeClassrooms.map((c) => c.id),
        },
      },
      select: {
        id: true,
        classroomId: true,
        startTime: true,
        endTime: true,
        status: true,
        type: true,
        meetingUrl: true,
      },
      orderBy: {
        startTime: 'asc',
      },
      take: 10,
    });

    // Lấy classroom names và student counts cho sessions
    const sessionsWithDetails = await Promise.all(
      upcomingSessions.map(async (session) => {
        const [classroom, studentsCount] = await Promise.all([
          this.prisma.classroom.findUnique({
            where: { id: session.classroomId },
            select: { name: true },
          }),
          this.prisma.classroomStudent.count({
            where: {
              classroomId: session.classroomId,
              isActive: true,
            },
          }),
        ]);

        return {
          ...session,
          classroomName: classroom?.name || 'Unknown',
          studentsCount,
        };
      }),
    );

    // 3. Lấy số lượng và danh sách các bài nộp chưa chấm
    const classroomIds = activeClassrooms.map((c) => c.id);

    const pendingSubmissions = await this.prisma.assignmentSubmission.findMany({
      where: {
        assignment: {
          classroomId: {
            in: classroomIds,
          },
        },
        status: 'submitted',
        score: null,
      },
      select: {
        id: true,
        assignmentId: true,
        studentId: true,
        submittedAt: true,
      },
      orderBy: {
        submittedAt: 'desc',
      },
      take: 10,
    });

    // Lấy thông tin student, assignment và classroom
    const submissionsWithDetails = await Promise.all(
      pendingSubmissions.map(async (submission) => {
        const [student, assignment] = await Promise.all([
          this.prisma.user.findUnique({
            where: { id: submission.studentId },
            select: {
              displayName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          }),
          this.prisma.assignment.findUnique({
            where: { id: submission.assignmentId },
            select: {
              title: true,
              classroomId: true,
            },
          }),
        ]);

        const classroom = assignment
          ? await this.prisma.classroom.findUnique({
              where: { id: assignment.classroomId },
              select: { name: true },
            })
          : null;

        return {
          ...submission,
          student,
          assignment: assignment
            ? {
                title: assignment.title,
                classroom: classroom ? { name: classroom.name } : null,
              }
            : null,
        };
      }),
    );

    // 4. Lấy thông báo gần đây
    const recentNotifications = await this.prisma.notification.findMany({
      where: {
        userId: teacherUserId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    // 5. Tính tổng số học sinh
    const totalStudents = classroomsWithDetails.reduce(
      (sum, classroom) => sum + classroom.studentsCount,
      0,
    );

    // 6. Đếm tổng số buổi học sắp tới trong 7 ngày
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingSessionsCount = await this.prisma.classroomSession.count({
      where: {
        startTime: {
          gte: now,
          lte: next7Days,
        },
        classroom: {
          teacherId: teacherUserId,
        },
      },
    });

    // 7. Format dữ liệu trả về
    return {
      totalActiveClassrooms: activeClassrooms.length,
      totalStudents,
      upcomingSessionsCount,
      pendingSubmissionsCount: pendingSubmissions.length,
      activeClassrooms: classroomsWithDetails.map((classroom) => ({
        id: classroom.id,
        name: classroom.name,
        classCode: classroom.classCode,
        status: classroom.status,
        studentsCount: classroom.studentsCount,
        maxStudents: classroom.maxStudents,
        courseName: classroom.courseName,
        nextSessionTime: classroom.nextSessionTime?.toISOString() || null,
      })),
      upcomingSessions: sessionsWithDetails.map((session) => ({
        id: session.id,
        classroomId: session.classroomId,
        classroomName: session.classroomName,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString(),
        roomName: session.type === 'online' ? session.meetingUrl : null,
        studentsCount: session.studentsCount,
        status: session.status,
      })),
      pendingSubmissions: submissionsWithDetails.map((submission) => ({
        id: submission.id,
        assignmentId: submission.assignmentId,
        assignmentTitle: submission.assignment?.title || 'N/A',
        studentName:
          submission.student?.displayName ||
          `${submission.student?.firstName || ''} ${submission.student?.lastName || ''}`.trim() ||
          'N/A',
        studentEmail: submission.student?.email || '',
        submittedAt: submission.submittedAt.toISOString(),
        classroomName: submission.assignment?.classroom?.name || 'N/A',
      })),
      recentNotifications: recentNotifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.body,
        type: this.mapNotificationTypeToUIType(notification.type),
        createdAt: notification.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Map notification type from DB to UI type
   */
  private mapNotificationTypeToUIType(
    type: string,
  ): 'success' | 'warning' | 'error' | 'info' {
    const typeMap: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
      achievement: 'success',
      reminder: 'warning',
      system: 'info',
      social: 'info',
      assignment: 'info',
      parent_child: 'info',
    };
    return typeMap[type] || 'info';
  }
}
