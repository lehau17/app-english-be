import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DashboardStudentService {
  constructor(private readonly prisma: PrismaRepository) {}

  async getDashboard(userId: string) {

    return {

    };
  }
}
