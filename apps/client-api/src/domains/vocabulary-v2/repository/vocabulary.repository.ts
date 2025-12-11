import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  UserVocabularyProgress,
  VocabularyList,
  VocabularyTerm,
  VocabularyUnit,
} from '@prisma/client';

@Injectable()
export class VocabularyRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  // ==================== LISTS ====================

  async createList(
    data: Prisma.VocabularyListCreateInput,
  ): Promise<VocabularyList> {
    return this.prisma.vocabularyList.create({ data });
  }

  async findListById(id: string, includeUnits = false) {
    return this.prisma.vocabularyList.findUnique({
      where: { id },
      include: includeUnits
        ? {
            units: {
              orderBy: { orderIndex: 'asc' },
              include: {
                terms: {
                  orderBy: { orderIndex: 'asc' },
                },
              },
            },
          }
        : undefined,
    });
  }

  async findLists(params: {
    where?: Prisma.VocabularyListWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.VocabularyListOrderByWithRelationInput;
  }) {
    const { where, skip, take, orderBy } = params;
    return this.prisma.vocabularyList.findMany({
      where,
      skip,
      take,
      orderBy: orderBy || { createdAt: 'desc' },
    });
  }

  async countLists(where?: Prisma.VocabularyListWhereInput): Promise<number> {
    return this.prisma.vocabularyList.count({ where });
  }

  async updateList(
    id: string,
    data: Prisma.VocabularyListUpdateInput,
  ): Promise<VocabularyList> {
    return this.prisma.vocabularyList.update({
      where: { id },
      data,
    });
  }

  async deleteList(id: string): Promise<VocabularyList> {
    return this.prisma.vocabularyList.delete({
      where: { id },
    });
  }

  async incrementListUserCount(id: string): Promise<void> {
    await this.prisma.vocabularyList.update({
      where: { id },
      data: { userCount: { increment: 1 } },
    });
  }

  async decrementListUserCount(id: string): Promise<void> {
    await this.prisma.vocabularyList.update({
      where: { id },
      data: { userCount: { decrement: 1 } },
    });
  }

  // ==================== UNITS ====================

  async createUnit(
    data: Prisma.VocabularyUnitCreateInput,
  ): Promise<VocabularyUnit> {
    return this.prisma.vocabularyUnit.create({ data });
  }

  async findUnitById(id: string, includeTerms = false) {
    return this.prisma.vocabularyUnit.findUnique({
      where: { id },
      include: includeTerms
        ? {
            terms: {
              orderBy: { orderIndex: 'asc' },
            },
          }
        : undefined,
    });
  }

  async findUnitsByListId(listId: string, includeTerms = false) {
    return this.prisma.vocabularyUnit.findMany({
      where: { listId },
      orderBy: { orderIndex: 'asc' },
      include: includeTerms
        ? {
            terms: {
              orderBy: { orderIndex: 'asc' },
            },
          }
        : undefined,
    });
  }

  async updateUnit(
    id: string,
    data: Prisma.VocabularyUnitUpdateInput,
  ): Promise<VocabularyUnit> {
    return this.prisma.vocabularyUnit.update({
      where: { id },
      data,
    });
  }

  async deleteUnit(id: string): Promise<VocabularyUnit> {
    return this.prisma.vocabularyUnit.delete({
      where: { id },
    });
  }

  // ==================== TERMS ====================

  async createTerm(
    data: Prisma.VocabularyTermCreateInput,
  ): Promise<VocabularyTerm> {
    return this.prisma.vocabularyTerm.create({ data });
  }

  async createManyTerms(
    data: Prisma.VocabularyTermCreateManyInput[],
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.vocabularyTerm.createMany({ data });
  }

  async findTermById(id: string) {
    return this.prisma.vocabularyTerm.findUnique({
      where: { id },
    });
  }

  async findTermsByUnitId(unitId: string) {
    return this.prisma.vocabularyTerm.findMany({
      where: { unitId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async findTermsByListId(listId: string) {
    return this.prisma.vocabularyTerm.findMany({
      where: {
        unit: {
          listId,
        },
      },
      include: {
        unit: true,
      },
      orderBy: [{ unit: { orderIndex: 'asc' } }, { orderIndex: 'asc' }],
    });
  }

  async updateTerm(
    id: string,
    data: Prisma.VocabularyTermUpdateInput,
  ): Promise<VocabularyTerm> {
    return this.prisma.vocabularyTerm.update({
      where: { id },
      data,
    });
  }

  async deleteTerm(id: string): Promise<VocabularyTerm> {
    return this.prisma.vocabularyTerm.delete({
      where: { id },
    });
  }

  // ==================== USER LISTS ====================

  async addListToUser(userId: string, listId: string, totalTerms: number) {
    return this.prisma.userVocabularyList.create({
      data: {
        userId,
        listId,
        totalTerms,
      },
    });
  }

  async removeListFromUser(userId: string, listId: string) {
    return this.prisma.userVocabularyList.delete({
      where: {
        userId_listId: {
          userId,
          listId,
        },
      },
    });
  }

  async findUserList(userId: string, listId: string) {
    return this.prisma.userVocabularyList.findUnique({
      where: {
        userId_listId: {
          userId,
          listId,
        },
      },
    });
  }

  async findUserLists(userId: string) {
    return this.prisma.userVocabularyList.findMany({
      where: { userId },
      include: {
        list: true,
      },
      orderBy: { addedAt: 'desc' },
    });
  }

  async updateUserListProgress(
    userId: string,
    listId: string,
    data: Prisma.UserVocabularyListUpdateInput,
  ) {
    return this.prisma.userVocabularyList.update({
      where: {
        userId_listId: {
          userId,
          listId,
        },
      },
      data,
    });
  }

  // ==================== USER PROGRESS (SRS) ====================

  async createProgress(
    data: Prisma.UserVocabularyProgressCreateInput,
  ): Promise<UserVocabularyProgress> {
    return this.prisma.userVocabularyProgress.create({ data });
  }

  async findProgress(userId: string, termId: string) {
    return this.prisma.userVocabularyProgress.findUnique({
      where: {
        userId_termId: {
          userId,
          termId,
        },
      },
    });
  }

  async deleteProgress(userId: string, termId: string): Promise<boolean> {
    try {
      await this.prisma.userVocabularyProgress.delete({
        where: {
          userId_termId: {
            userId,
            termId,
          },
        },
      });
      return true;
    } catch (error) {
      // Progress doesn't exist, return false
      return false;
    }
  }

  async getTermsByUnit(unitId: string): Promise<VocabularyTerm[]> {
    return this.prisma.vocabularyTerm.findMany({
      where: {
        unitId,
      },
    });
  }

  async findUserProgress(
    userId: string,
    params?: {
      listId?: string;
      status?: string;
    },
  ) {
    const where: Prisma.UserVocabularyProgressWhereInput = { userId };

    if (params?.listId) {
      where.term = {
        unit: {
          listId: params.listId,
        },
      };
    }

    if (params?.status) {
      where.status = params.status;
    }

    return this.prisma.userVocabularyProgress.findMany({
      where,
      include: {
        term: {
          include: {
            unit: true,
          },
        },
      },
    });
  }

  async findDueCards(
    userId: string,
    params?: {
      listId?: string;
      limit?: number;
    },
  ) {
    const where: Prisma.UserVocabularyProgressWhereInput = {
      userId,
      nextReviewAt: {
        lte: new Date(),
      },
    };

    if (params?.listId) {
      where.term = {
        unit: {
          listId: params.listId,
        },
      };
    }

    return this.prisma.userVocabularyProgress.findMany({
      where,
      take: params?.limit || 20,
      orderBy: { nextReviewAt: 'asc' },
      include: {
        term: {
          include: {
            unit: true,
          },
        },
      },
    });
  }

  async findNewCards(
    userId: string,
    params?: {
      listId?: string;
      unitId?: string;
      limit?: number;
    },
  ) {
    const where: Prisma.VocabularyTermWhereInput = {
      NOT: {
        userProgress: {
          some: {
            userId,
          },
        },
      },
    };

    if (params?.listId) {
      where.unit = {
        listId: params.listId,
      };
    }

    if (params?.unitId) {
      where.unitId = params.unitId;
    }

    return this.prisma.vocabularyTerm.findMany({
      where,
      take: params?.limit || 10,
      orderBy: [{ unit: { orderIndex: 'asc' } }, { orderIndex: 'asc' }],
      include: {
        unit: true,
      },
    });
  }

  async updateProgress(
    userId: string,
    termId: string,
    data: Prisma.UserVocabularyProgressUpdateInput,
  ): Promise<UserVocabularyProgress> {
    return this.prisma.userVocabularyProgress.update({
      where: {
        userId_termId: {
          userId,
          termId,
        },
      },
      data,
    });
  }

  async upsertProgress(
    userId: string,
    termId: string,
    create: Prisma.UserVocabularyProgressCreateInput,
    update: Prisma.UserVocabularyProgressUpdateInput,
  ): Promise<UserVocabularyProgress> {
    return this.prisma.userVocabularyProgress.upsert({
      where: {
        userId_termId: {
          userId,
          termId,
        },
      },
      create,
      update,
    });
  }

  // ==================== REVIEW SESSIONS ====================

  async createReviewSession(data: Prisma.VocabularyReviewSessionCreateInput) {
    return this.prisma.vocabularyReviewSession.create({ data });
  }

  async findUserReviewSessions(
    userId: string,
    params?: {
      listId?: string;
      limit?: number;
    },
  ) {
    const where: Prisma.VocabularyReviewSessionWhereInput = { userId };

    if (params?.listId) {
      where.listId = params.listId;
    }

    return this.prisma.vocabularyReviewSession.findMany({
      where,
      take: params?.limit || 50,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==================== STATISTICS ====================

  async getListStats(listId: string) {
    const [totalTerms, totalUnits] = await Promise.all([
      this.prisma.vocabularyTerm.count({
        where: {
          unit: {
            listId,
          },
        },
      }),
      this.prisma.vocabularyUnit.count({
        where: { listId },
      }),
    ]);

    return { totalTerms, totalUnits };
  }

  async getUserListStats(userId: string, listId: string) {
    const progressData = await this.prisma.userVocabularyProgress.groupBy({
      by: ['status'],
      where: {
        userId,
        term: {
          unit: {
            listId,
          },
        },
      },
      _count: true,
    });

    const stats = {
      newCount: 0,
      learningCount: 0,
      reviewCount: 0,
      masteredCount: 0,
    };

    progressData.forEach((item) => {
      if (item.status === 'new') stats.newCount = item._count;
      if (item.status === 'learning') stats.learningCount = item._count;
      if (item.status === 'review') stats.reviewCount = item._count;
      if (item.status === 'mastered') stats.masteredCount = item._count;
    });

    const dueToday = await this.prisma.userVocabularyProgress.count({
      where: {
        userId,
        term: {
          unit: {
            listId,
          },
        },
        nextReviewAt: {
          lte: new Date(),
        },
      },
    });

    return { ...stats, dueToday };
  }

  /**
   * Count total mastered terms for a user
   */
  async countMasteredTerms(userId: string): Promise<number> {
    return this.prisma.userVocabularyProgress.count({
      where: {
        userId,
        status: 'mastered',
      },
    });
  }

  /**
   * Update termCount for all vocabulary units based on actual term counts
   * Used by background worker to sync cached counts
   */
  async updateAllUnitTermCounts(): Promise<{
    unitsUpdated: number;
    totalTerms: number;
  }> {
    // Get all units with their IDs only
    const units = await this.prisma.vocabularyUnit.findMany({
      select: { id: true },
    });

    if (units.length === 0) {
      return { unitsUpdated: 0, totalTerms: 0 };
    }

    // Count terms for each unit in parallel
    const unitCounts = await Promise.all(
      units.map(async (unit) => {
        const termCount = await this.prisma.vocabularyTerm.count({
          where: { unitId: unit.id },
        });
        return { unitId: unit.id, termCount };
      }),
    );

    // Update all units in parallel
    await Promise.all(
      unitCounts.map(({ unitId, termCount }) =>
        this.prisma.vocabularyUnit.update({
          where: { id: unitId },
          data: { termCount },
        }),
      ),
    );

    const totalTerms = unitCounts.reduce(
      (sum, { termCount }) => sum + termCount,
      0,
    );

    return {
      unitsUpdated: units.length,
      totalTerms,
    };
  }
}
