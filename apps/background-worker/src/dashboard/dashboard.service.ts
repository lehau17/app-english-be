import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaRepository) {}

  async calculateDashboardData() {
    const [
      totalStudents,
      totalCourses,
      totalLessons,
      totalActivities,
      recentStudents,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { role: 'student' } }),
      this.prisma.course.count(),
      this.prisma.lesson.count(),
      this.prisma.activity.count(),
      this.prisma.user.findMany({
        where: { role: 'student' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const registrationTrend = await this.getRegistrationTrend();

    const dashboardData = {
      totalStudents,
      totalCourses,
      totalLessons,
      totalActivities,
      recentStudents: JSON.stringify(recentStudents),
      registrationTrend: JSON.stringify(registrationTrend),
    };

    await this.prisma.dashboard.create({
      data: dashboardData,
    });

    return dashboardData;
  }

  private async getRegistrationTrend() {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const last7Days = new Date();
    last7Days.setDate(today.getDate() - 6);
    last7Days.setHours(0, 0, 0, 0);

    const registrations = await this.prisma.user.findMany({
      where: {
        role: 'student',
        createdAt: {
          gte: last7Days,
          lte: today,
        },
      },
      select: {
        createdAt: true,
      },
    });

    const trendMap = new Map<string, number>();
    registrations.forEach((reg) => {
      const date = reg.createdAt.toISOString().split('T')[0];
      trendMap.set(date, (trendMap.get(date) || 0) + 1);
    });

    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      trend.push({
        date: dateString,
        count: trendMap.get(dateString) || 0,
      });
    }

    return trend;
  }
}
