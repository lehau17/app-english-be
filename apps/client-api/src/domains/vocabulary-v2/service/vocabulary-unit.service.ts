import { Injectable, NotFoundException } from '@nestjs/common';
import { VocabularyTermResponseDto } from '../dto/vocabulary-term.dto';
import {
  CreateVocabularyUnitDto,
  UpdateVocabularyUnitDto,
  VocabularyUnitResponseDto,
} from '../dto/vocabulary-unit.dto';
import { VocabularyRepository } from '../repository/vocabulary.repository';

@Injectable()
export class VocabularyUnitService {
  constructor(private readonly repository: VocabularyRepository) {}

  /**
   * Get all units in a list with user progress
   */
  async getUnits(
    listId: string,
    userId?: string,
  ): Promise<VocabularyUnitResponseDto[]> {
    const units = await this.repository.findUnitsByListId(listId, true); // Include terms

    return Promise.all(
      units.map(async (unit) => {
        let completedTerms = 0;

        // Calculate user progress if authenticated
        if (userId && unit.terms) {
          const termIds = unit.terms.map((t) => t.id);

          // Count how many terms have progress
          for (const termId of termIds) {
            const progress = await this.repository.findProgress(userId, termId);
            if (
              progress &&
              (progress.status === 'mastered' || progress.status === 'review')
            ) {
              completedTerms++;
            }
          }
        }

        return {
          id: unit.id,
          listId: unit.listId,
          title: unit.title,
          description: unit.description || undefined,
          orderIndex: unit.orderIndex,
          termCount: unit.termCount,
          createdAt: unit.createdAt,
          updatedAt: unit.updatedAt,
          // Add progress info
          userProgress: userId
            ? {
                completedTerms,
                totalTerms: unit.termCount,
              }
            : undefined,
        };
      }),
    );
  }

  /**
   * Get single unit with terms
   */
  async getUnit(
    unitId: string,
    userId?: string,
  ): Promise<VocabularyUnitResponseDto> {
    const unit = await this.repository.findUnitById(unitId, true);

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${unitId} not found`);
    }

    // Map terms with user progress if authenticated
    const terms: VocabularyTermResponseDto[] | undefined = unit.terms
      ? await Promise.all(
          unit.terms.map(async (term) => {
            const termDto: VocabularyTermResponseDto = {
              id: term.id,
              unitId: term.unitId,
              word: term.word,
              definition: term.definition,
              pronunciation: term.pronunciation || undefined,
              partOfSpeech: term.partOfSpeech || undefined,
              audioUrl: term.audioUrl || undefined,
              imageUrl: term.imageUrl || undefined,
              examples: term.examples || undefined,
              synonyms: term.synonyms,
              antonyms: term.antonyms,
              ipaUs: term.ipaUs || undefined,
              ipaUk: term.ipaUk || undefined,
              translationVi: term.translationVi || undefined,
              orderIndex: term.orderIndex,
              difficulty: term.difficulty as string,
              createdAt: term.createdAt,
              updatedAt: term.updatedAt,
            };

            // Get user progress if authenticated
            if (userId) {
              const progress = await this.repository.findProgress(
                userId,
                term.id,
              );
              if (progress) {
                termDto.userProgress = {
                  status: progress.status,
                  nextReviewAt: progress.nextReviewAt,
                  correctCount: progress.correctCount,
                  wrongCount: progress.wrongCount,
                  repetitions: progress.repetitions,
                  lastReviewAt: progress.lastReviewAt,
                };
              }
            }

            return termDto;
          }),
        )
      : undefined;

    return {
      id: unit.id,
      listId: unit.listId,
      title: unit.title,
      description: unit.description || undefined,
      orderIndex: unit.orderIndex,
      termCount: unit.termCount,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
      terms,
    };
  }

  /**
   * Create unit (Admin/Teacher)
   */
  async createUnit(
    listId: string,
    dto: CreateVocabularyUnitDto,
  ): Promise<VocabularyUnitResponseDto> {
    // Check if list exists
    const list = await this.repository.findListById(listId);
    if (!list) {
      throw new NotFoundException(`List with ID ${listId} not found`);
    }

    // Determine order index
    const orderIndex = dto.orderIndex ?? list.totalUnits;

    const unit = await this.repository.createUnit({
      title: dto.title,
      description: dto.description,
      orderIndex,
      list: {
        connect: { id: listId },
      },
    });

    // Update list totalUnits
    await this.repository.updateList(listId, {
      totalUnits: { increment: 1 },
    });

    return {
      id: unit.id,
      listId: unit.listId,
      title: unit.title,
      description: unit.description || undefined,
      orderIndex: unit.orderIndex,
      termCount: unit.termCount,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    };
  }

  /**
   * Update unit
   */
  async updateUnit(
    unitId: string,
    dto: UpdateVocabularyUnitDto,
  ): Promise<VocabularyUnitResponseDto> {
    const unit = await this.repository.findUnitById(unitId);
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${unitId} not found`);
    }

    const updated = await this.repository.updateUnit(unitId, dto);

    return {
      id: updated.id,
      listId: updated.listId,
      title: updated.title,
      description: updated.description || undefined,
      orderIndex: updated.orderIndex,
      termCount: updated.termCount,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Delete unit
   */
  async deleteUnit(unitId: string): Promise<void> {
    const unit = await this.repository.findUnitById(unitId);
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${unitId} not found`);
    }

    await this.repository.deleteUnit(unitId);

    // Update list stats
    await this.repository.updateList(unit.listId, {
      totalUnits: { decrement: 1 },
      totalTerms: { decrement: unit.termCount },
    });
  }

  /**
   * Reorder units in a list
   */
  async reorderUnits(listId: string, unitIds: string[]): Promise<void> {
    // Update each unit's orderIndex
    await Promise.all(
      unitIds.map((unitId, index) =>
        this.repository.updateUnit(unitId, { orderIndex: index }),
      ),
    );
  }
}
