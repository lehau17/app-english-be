import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma, Transaction } from '@prisma/client';

@Injectable()
export class PaymentRepository extends PrismaRepository {
  async createTransaction(
    data: Prisma.TransactionCreateInput,
  ): Promise<Transaction> {
    return this.transaction.create({ data });
  }

  async findTransactionByTxnRef(
    vnpayTxnRef: string,
  ): Promise<Transaction | null> {
    return this.transaction.findFirst({
      where: { vnpayTxnRef },
      include: {
        student: true,
        course: true,
        classroom: true,
      },
    });
  }

  async findTransactionById(id: string): Promise<Transaction | null> {
    return this.transaction.findUnique({
      where: { id },
      include: {
        student: true,
        course: true,
        classroom: true,
      },
    });
  }

  async updateTransactionStatus(
    id: string,
    status: PaymentStatus,
    data: Partial<Prisma.TransactionUpdateInput> = {},
  ): Promise<Transaction> {
    return this.transaction.update({
      where: { id },
      data: {
        status,
        ...data,
        updatedAt: new Date(),
        ...(status === PaymentStatus.success
          ? { completedAt: new Date() }
          : {}),
      },
    });
  }

  async getAllTransactions(
    limit: number = 10,
    cursor?: string,
    filters?: {
      status?: PaymentStatus;
      startDate?: Date;
      endDate?: Date;
      studentId?: string;
    },
  ): Promise<{ data: Transaction[]; total: number; nextCursor?: string }> {
    const where: Prisma.TransactionWhereInput = {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.studentId ? { studentId: filters.studentId } : {}),
      ...(filters?.startDate || filters?.endDate
        ? {
            createdAt: {
              ...(filters.startDate ? { gte: filters.startDate } : {}),
              ...(filters.endDate ? { lte: filters.endDate } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.transaction.findMany({
        where,
        include: {
          student: true,
          course: true,
          classroom: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Take one more to check for next page
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.transaction.count({ where }),
    ]);

    let nextCursor: string | undefined = undefined;
    if (data.length > limit) {
      const nextItem = data.pop();
      nextCursor = nextItem?.id;
    }

    return { data, total, nextCursor };
  }

  async getStudentTransactions(
    studentId: string,
    limit: number = 10,
    cursor?: string,
  ): Promise<Transaction[]> {
    return this.transaction.findMany({
      where: { studentId },
      include: {
        course: true,
        classroom: true,
        classroomSession: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  async checkDuplicateTransaction(
    studentId: string,
    courseId: string,
    classroomId: string,
  ): Promise<Transaction | null> {
    return this.transaction.findFirst({
      where: {
        studentId,
        courseId,
        classroomId,
        status: PaymentStatus.success,
      },
    });
  }

  async updateStudentPurchaseStatus(
    studentId: string,
    classroomId: string,
    isPurchased: boolean,
  ): Promise<void> {
    // Sử dụng upsert: tạo mới hoặc update
    // Khi thanh toán thành công, tự động enroll student vào classroom
    await this.classroomStudent.upsert({
      where: {
        classroomId_studentId: {
          classroomId,
          studentId,
        },
      },
      create: {
        classroomId,
        studentId,
        isPurchased,
        isActive: true,
      },
      update: {
        isPurchased,
        isActive: true, // Kích hoạt lại nếu bị inactive
      },
    });
  }

  async getStudentPurchaseStatus(
    studentId: string,
    classroomId: string,
  ): Promise<{ isPurchased: boolean } | null> {
    return this.classroomStudent.findUnique({
      where: {
        classroomId_studentId: {
          classroomId,
          studentId,
        },
      },
      select: { isPurchased: true },
    });
  }
}
