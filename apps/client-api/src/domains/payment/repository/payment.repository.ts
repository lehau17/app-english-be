import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma, Transaction } from '@prisma/client';

@Injectable()
export class PaymentRepository extends PrismaRepository {
  async createTransaction(data: Prisma.TransactionCreateInput): Promise<Transaction> {
    return this.transaction.create({ data });
  }

  async findTransactionByTxnRef(vnpayTxnRef: string): Promise<Transaction | null> {
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
        ...(status === PaymentStatus.success ? { completedAt: new Date() } : {}),
      },
    });
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
    await this.classroomStudent.update({
      where: {
        classroomId_studentId: {
          classroomId,
          studentId,
        },
      },
      data: { isPurchased },
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
