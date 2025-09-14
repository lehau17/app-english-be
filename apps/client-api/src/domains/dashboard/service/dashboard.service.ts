import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { DashboardDto } from '../dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaRepository) {}

  async getDashboardData(): Promise<DashboardDto> {
    const dashboard = await this.prisma.dashboard.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!dashboard) {
      // throw new NotFoundException('Dashboard data not found. Please run the background worker first.');
      return DashboardDto.defaultValueResponse();
    }

    return {
        ...dashboard,
        recentStudents: JSON.parse(dashboard.recentStudents as string),
        registrationTrend: JSON.parse(dashboard.registrationTrend as string),
    };
  }
}
