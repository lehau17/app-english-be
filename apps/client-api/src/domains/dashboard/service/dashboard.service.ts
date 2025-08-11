
import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { DashboardDto } from '../dto/dashboard.dto';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaRepository) {}

    async getDashboardData(): Promise<DashboardDto> {
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
            select: { id: true, firstName: true, lastName: true, email: true, createdAt: true }, // Select only public fields
        });

        // Mocking registration trend data for the last 7 days
        const registrationTrend = Array.from({ length: 7 }).map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return {
                date: date.toISOString().split('T')[0],
                count: Math.floor(Math.random() * 20) + 5, // Random count between 5 and 25
            };
        }).reverse();

        return {
            totalStudents,
            totalCourses,
            totalLessons,
            totalActivities,
            recentStudents,
            registrationTrend,
        };
    }
}
