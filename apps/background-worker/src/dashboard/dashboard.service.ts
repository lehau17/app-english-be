import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaRepository) {}

  async calculateDashboardData() {
    const totalStudents = await this.prisma.user.count({
      where: { role: 'student' },
    });
    const totalCourses = await this.prisma.course.count();
    const totalLessons = await this.prisma.lesson.count();
    const totalActivities = await this.prisma.activity.count();
    const recentStudents = await this.prisma.user.findMany({
      where: { role: 'student' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const registrationTrend = await this.prisma.user.groupBy({
      by: ['createdAt'],
      _count: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const dashboardData = {
      totalStudents,
      totalCourses,
      totalLessons,
      totalActivities,
      recentStudents: JSON.stringify(recentStudents),
      registrationTrend: JSON.stringify(
        registrationTrend.map((item) => ({
          date: item.createdAt.toISOString().split('T')[0],
          count: item._count.createdAt,
        })),
      ),
    };

    await this.prisma.dashboard.create({
      data: dashboardData,
    });

    return dashboardData;
  }
}
