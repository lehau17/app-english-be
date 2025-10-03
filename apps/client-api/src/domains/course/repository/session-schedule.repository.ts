import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class SessionScheduleRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async createMany(
    data: Prisma.SessionScheduleCreateManyInput[],
  ) {
    return await this.prisma.sessionSchedule.createMany({
      data,
    });
  }

  async create(
    data: Prisma.SessionScheduleCreateInput,
  ) {
    return await this.prisma.sessionSchedule.create({
      data,
    });
  }

  async findByCourseId(courseId: string) {
    return await this.prisma.sessionSchedule.findMany({
      where: { courseId },
      include: {
        activities: {
          include: {
            activity: true,
          },
          orderBy: { orderNo: 'asc' },
        },
      },
      orderBy: { sessionNumber: 'asc' },
    });
  }

  async deleteAllByCourseId(courseId: string) {
    // SessionActivity sẽ tự động xóa cascade
    return await this.prisma.sessionSchedule.deleteMany({
      where: { courseId },
    });
  }
}
