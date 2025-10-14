import { PrismaRepository } from '@app/database/prisma.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';

@Injectable()
export class AdminTransactionRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async findAll(filter: TransactionFilterDto) {
    const {
      page,
      limit,
      status,
      studentEmail,
      courseId,
      classroomId,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = filter;

    const where: Prisma.TransactionWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (studentEmail) {
      where.student = {
        email: {
          contains: studentEmail,
          mode: 'insensitive',
        },
      };
    }

    if (courseId) {
      where.courseId = courseId;
    }

    if (classroomId) {
      where.classroomId = classroomId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
          },
        },
        classroom: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.transaction.count({ where });

    return {
      data: transactions,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: {
        student: true,
        course: true,
        classroom: true,
      },
    });
  }

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const totalRevenueToday = await this.prisma.transaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: 'success',
        createdAt: {
          gte: today,
        },
      },
    });

    const totalRevenueThisMonth = await this.prisma.transaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: 'success',
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    const statusCounts = await this.prisma.transaction.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    return {
      totalRevenueToday: totalRevenueToday._sum.amount || 0,
      totalRevenueThisMonth: totalRevenueThisMonth._sum.amount || 0,
      statusCounts: statusCounts.reduce((acc, curr) => {
        acc[curr.status] = curr._count.status;
        return acc;
      }, {}),
    };
  }
}