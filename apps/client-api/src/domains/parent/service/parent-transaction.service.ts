import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { GetTransactionsQueryDto } from '../dto/get-transactions-query.dto';

@Injectable()
export class ParentTransactionService {
  constructor(private readonly prisma: PrismaRepository) {}

  async getParentTransactions(
    parentId: string,
    query: GetTransactionsQueryDto,
  ) {
    const { page, limit, childId, status } = query;

    // Step 1: Find all children of the parent
    const parentChildren = await this.prisma.parentChild.findMany({
      where: { parentId },
      select: { childId: true },
    });

    if (parentChildren.length === 0) {
      return []; // No children, no transactions
    }

    const childIds = parentChildren.map((pc) => pc.childId);

    // Step 2: Validate childId filter if provided
    if (childId && !childIds.includes(childId)) {
      // If a specific childId is requested, it must belong to the parent
      return [];
    }

    // Step 3: Build the query for transactions
    const whereClause: any = {
      studentId: {
        in: childId ? [childId] : childIds,
      },
    };

    if (status) {
      whereClause.status = status;
    }

    const transactions = await this.prisma.transaction.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            thumbnail: true,
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
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return transactions;
  }
}
