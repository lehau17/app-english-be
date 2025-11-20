import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { DashboardDto } from '../dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaRepository) {}

  async getDashboardData(): Promise<DashboardDto> {
    const now = new Date();

    const [
      latestSnapshot,
      courseDistributionRaw,
      upcomingSessionsRaw,
      recentNotifications,
    ] = await this.prisma.$transaction([
      this.getLatestSnapshot(),
      this.getCourseDistribution(),
      this.getUpcomingSessions(now),
      this.getRecentNotifications(now),
    ]);

    // Use snapshot if available and recent (within 24 hours), otherwise use real-time
    const snapshotAge = latestSnapshot
      ? now.getTime() - latestSnapshot.createdAt.getTime()
      : Infinity;
    const useSnapshot = latestSnapshot && snapshotAge < 24 * 60 * 60 * 1000;

    let baseSnapshot: DashboardDto;

    if (useSnapshot) {
      baseSnapshot = this.mapSnapshot(latestSnapshot);
    } else {
      // Real-time queries as fallback
      const [realTimeStats, recentStudentsRaw, registrationTrendRaw] =
        await Promise.all([
          this.getRealTimeStats(),
          this.getRecentStudents(),
          this.getRegistrationTrend(),
        ]);

      baseSnapshot = {
        totalStudents: realTimeStats.totalStudents,
        totalCourses: realTimeStats.totalCourses,
        totalLessons: realTimeStats.totalLessons,
        totalActivities: realTimeStats.totalActivities,
        recentStudents: this.mapRecentStudents(recentStudentsRaw),
        registrationTrend: registrationTrendRaw,
        courseDistribution: [], // Will be set below
        upcomingClasses: [], // Will be set below
        notifications: [], // Will be set below
      };
    }

    const courseDistribution = this.mapCourseDistribution(
      courseDistributionRaw,
    );
    const upcomingClasses = this.mapUpcomingSessions(upcomingSessionsRaw);
    const notifications = this.mapNotifications(recentNotifications);

    return {
      ...baseSnapshot,
      courseDistribution,
      upcomingClasses,
      notifications,
    };
  }

  // ---------- Queries ----------

  private getLatestSnapshot() {
    return this.prisma.dashboard.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }

  private getCourseDistribution() {
    return this.prisma.course.groupBy({
      by: ['difficulty'],
      _count: { _all: true },
    });
  }

  private getUpcomingSessions(now: Date) {
    return this.prisma.classroomSession.findMany({
      where: {
        status: { in: ['scheduled', 'ongoing'] },
        OR: [
          { startTime: { gte: now } }, // chưa bắt đầu
          {
            AND: [
              { startTime: { lt: now } }, // đã bắt đầu
              { endTime: { gte: now } }, // nhưng chưa kết thúc
            ],
          },
        ],
      },
      orderBy: { startTime: 'asc' },
      take: 5,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        type: true,
        meetingUrl: true,
        location: true,
        classroom: {
          select: {
            id: true,
            name: true,
            maxStudents: true,
            students: {
              where: { isActive: true },
              select: { studentId: true },
            },
            course: { select: { title: true } },
          },
        },
        instructor: {
          select: { displayName: true, firstName: true, lastName: true },
        },
      },
    });
  }

  private getRecentNotifications(now: Date) {
    return this.prisma.notification.findMany({
      where: {
        AND: [
          { OR: [{ targetRole: 'admin' }, { targetRole: null }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  // Real-time queries (fallback when snapshot is null or old)
  private async getRealTimeStats() {
    const [totalStudents, totalCourses, totalLessons, totalActivities] =
      await Promise.all([
        this.prisma.user.count({ where: { role: 'student' } }),
        this.prisma.course.count(),
        this.prisma.lesson.count(),
        this.prisma.activity.count(),
      ]);

    return {
      totalStudents,
      totalCourses,
      totalLessons,
      totalActivities,
    };
  }

  private getRecentStudents() {
    return this.prisma.user.findMany({
      where: { role: 'student' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  private async getRegistrationTrend() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const registrations = await this.prisma.user.findMany({
      where: {
        role: 'student',
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        createdAt: true,
      },
    });

    // Group by date
    const trendMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      trendMap.set(dateKey, 0);
    }

    registrations.forEach((reg) => {
      const dateKey = reg.createdAt.toISOString().split('T')[0];
      const current = trendMap.get(dateKey) || 0;
      trendMap.set(dateKey, current + 1);
    });

    return Array.from(trendMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }

  // ---------- Mapping ----------

  private mapSnapshot(latestSnapshot: any): DashboardDto {
    const baseSnapshot = DashboardDto.defaultValueResponse();

    if (latestSnapshot) {
      baseSnapshot.totalStudents = latestSnapshot.totalStudents;
      baseSnapshot.totalCourses = latestSnapshot.totalCourses;
      baseSnapshot.totalLessons = latestSnapshot.totalLessons;
      baseSnapshot.totalActivities = latestSnapshot.totalActivities;
      baseSnapshot.recentStudents =
        safeJsonParse<any[]>(latestSnapshot.recentStudents) ?? [];
      baseSnapshot.registrationTrend =
        safeJsonParse<any[]>(latestSnapshot.registrationTrend) ?? [];
    }

    return baseSnapshot;
  }

  private mapCourseDistribution(
    raw: Array<{ difficulty: string; _count: { _all: number } }>,
  ) {
    const courseDifficultyLabel: Record<string, string> = {
      beginner: 'Beginner',
      elementary: 'Elementary',
      intermediate: 'Intermediate',
      upper_intermediate: 'Upper Intermediate',
      advanced: 'Advanced',
    };

    return raw.map((item) => ({
      label: courseDifficultyLabel[item.difficulty] ?? item.difficulty,
      value: item._count._all,
    }));
  }

  private mapUpcomingSessions(raw: any[]) {
    return raw.map((session) => {
      const instructor = session.instructor;
      const teacherName =
        instructor?.displayName ||
        [instructor?.firstName, instructor?.lastName]
          .filter(Boolean)
          .join(' ') ||
        'Chưa xác định';

      const classroom = session.classroom;
      const activeStudents = classroom?.students?.length ?? 0;

      // Determine room name: use location for offline, meetingUrl for online, or null
      const roomName =
        session.type === 'online'
          ? session.meetingUrl
            ? 'Online (Meeting Link)'
            : null
          : session.location || null;

      return {
        id: session.id,
        classroomName: classroom?.name ?? 'Lớp học chưa đặt tên',
        courseTitle: classroom?.course?.title,
        teacherName,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString(),
        roomName,
        activeStudents,
        maxStudents: classroom?.maxStudents ?? null,
      };
    });
  }

  private mapNotifications(raw: any[]) {
    const severityMap: Record<
      NotificationType | string,
      'success' | 'warning' | 'error' | 'info'
    > = {
      achievement: 'success',
      reminder: 'warning',
      assignment: 'warning',
      system: 'info',
      social: 'info',
      parent_child: 'info',
    };

    return raw.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.body,
      type: severityMap[notification.type] ?? 'info',
      createdAt: notification.createdAt.toISOString(),
    }));
  }

  private mapRecentStudents(raw: any[]) {
    return raw.map((student) => ({
      id: student.id,
      email: student.email,
      displayName: student.displayName,
      firstName: student.firstName,
      lastName: student.lastName,
    }));
  }
}

// ---------- Helper ----------

function safeJsonParse<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === 'object') return value as T;

  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return null;
  }
}
