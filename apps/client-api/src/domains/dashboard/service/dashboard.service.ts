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

    const baseSnapshot = this.mapSnapshot(latestSnapshot);
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
      include: {
        classroom: {
          include: {
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

      return {
        id: session.id,
        classroomName: classroom?.name ?? 'Lớp học chưa đặt tên',
        courseTitle: classroom?.course?.title,
        teacherName,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString(),
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
