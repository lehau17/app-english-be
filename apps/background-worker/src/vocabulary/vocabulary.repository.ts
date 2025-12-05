import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VocabularyRepository {
  constructor(private readonly prisma: PrismaRepository) {}



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

    const totalTerms = unitCounts.reduce((sum, { termCount }) => sum + termCount, 0);

    return {
      unitsUpdated: units.length,
      totalTerms,
    };
  }
}
