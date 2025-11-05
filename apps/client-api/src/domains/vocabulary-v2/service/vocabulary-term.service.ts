import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
    CreateVocabularyTermDto,
    UpdateVocabularyTermDto,
    VocabularyTermResponseDto,
} from '../dto/vocabulary-term.dto';
import { VocabularyRepository } from '../repository/vocabulary.repository';

@Injectable()
export class VocabularyTermService {
    constructor(private readonly repository: VocabularyRepository) { }

    /**
     * Get all terms in a unit
     */
    async getTerms(unitId: string, userId?: string): Promise<VocabularyTermResponseDto[]> {
        const terms = await this.repository.findTermsByUnitId(unitId);

        return Promise.all(
            terms.map(async (term) => {
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
                    const progress = await this.repository.findProgress(userId, term.id);
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
        );
    }

    /**
     * Get single term
     */
    async getTerm(termId: string, userId?: string): Promise<VocabularyTermResponseDto> {
        const term = await this.repository.findTermById(termId);

        if (!term) {
            throw new NotFoundException(`Term with ID ${termId} not found`);
        }

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

        if (userId) {
            const progress = await this.repository.findProgress(userId, term.id);
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
    }

    /**
     * Create term
     */
    async createTerm(
        unitId: string,
        dto: CreateVocabularyTermDto,
    ): Promise<VocabularyTermResponseDto> {
        // Check if unit exists
        const unit = await this.repository.findUnitById(unitId);
        if (!unit) {
            throw new NotFoundException(`Unit with ID ${unitId} not found`);
        }

        // Determine order index
        const orderIndex = dto.orderIndex ?? unit.termCount;

        const term = await this.repository.createTerm({
            word: dto.word,
            definition: dto.definition,
            pronunciation: dto.pronunciation,
            partOfSpeech: dto.partOfSpeech,
            audioUrl: dto.audioUrl,
            imageUrl: dto.imageUrl,
            examples: dto.examples as Prisma.JsonValue,
            synonyms: dto.synonyms || [],
            antonyms: dto.antonyms || [],
            ipaUs: dto.ipaUs,
            ipaUk: dto.ipaUk,
            translationVi: dto.translationVi,
            orderIndex,
            difficulty: dto.difficulty || 'beginner',
            unit: {
                connect: { id: unitId },
            },
        });

        // Update unit termCount
        await this.repository.updateUnit(unitId, {
            termCount: { increment: 1 },
        });

        // Update list totalTerms
        const updatedUnit = await this.repository.findUnitById(unitId);
        if (updatedUnit) {
            await this.repository.updateList(updatedUnit.listId, {
                totalTerms: { increment: 1 },
            });
        }

        return {
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
    }

    /**
     * Update term
     */
    async updateTerm(
        termId: string,
        dto: UpdateVocabularyTermDto,
    ): Promise<VocabularyTermResponseDto> {
        const term = await this.repository.findTermById(termId);
        if (!term) {
            throw new NotFoundException(`Term with ID ${termId} not found`);
        }

        const updateData: Prisma.VocabularyTermUpdateInput = {};

        if (dto.word !== undefined) updateData.word = dto.word;
        if (dto.definition !== undefined) updateData.definition = dto.definition;
        if (dto.pronunciation !== undefined) updateData.pronunciation = dto.pronunciation;
        if (dto.partOfSpeech !== undefined) updateData.partOfSpeech = dto.partOfSpeech;
        if (dto.audioUrl !== undefined) updateData.audioUrl = dto.audioUrl;
        if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;
        if (dto.examples !== undefined) updateData.examples = dto.examples as Prisma.JsonValue;
        if (dto.synonyms !== undefined) updateData.synonyms = dto.synonyms;
        if (dto.antonyms !== undefined) updateData.antonyms = dto.antonyms;
        if (dto.ipaUs !== undefined) updateData.ipaUs = dto.ipaUs;
        if (dto.ipaUk !== undefined) updateData.ipaUk = dto.ipaUk;
        if (dto.translationVi !== undefined) updateData.translationVi = dto.translationVi;
        if (dto.orderIndex !== undefined) updateData.orderIndex = dto.orderIndex;
        if (dto.difficulty !== undefined) updateData.difficulty = dto.difficulty;

        const updated = await this.repository.updateTerm(termId, updateData);

        return {
            id: updated.id,
            unitId: updated.unitId,
            word: updated.word,
            definition: updated.definition,
            pronunciation: updated.pronunciation || undefined,
            partOfSpeech: updated.partOfSpeech || undefined,
            audioUrl: updated.audioUrl || undefined,
            imageUrl: updated.imageUrl || undefined,
            examples: updated.examples || undefined,
            synonyms: updated.synonyms,
            antonyms: updated.antonyms,
            ipaUs: updated.ipaUs || undefined,
            ipaUk: updated.ipaUk || undefined,
            translationVi: updated.translationVi || undefined,
            orderIndex: updated.orderIndex,
            difficulty: updated.difficulty as string,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
        };
    }

    /**
     * Delete term
     */
    async deleteTerm(termId: string): Promise<void> {
        const term = await this.repository.findTermById(termId);
        if (!term) {
            throw new NotFoundException(`Term with ID ${termId} not found`);
        }

        await this.repository.deleteTerm(termId);

        // Update unit termCount
        await this.repository.updateUnit(term.unitId, {
            termCount: { decrement: 1 },
        });

        // Update list totalTerms
        const unit = await this.repository.findUnitById(term.unitId);
        if (unit) {
            await this.repository.updateList(unit.listId, {
                totalTerms: { decrement: 1 },
            });
        }
    }

    /**
     * Reorder terms in a unit
     */
    async reorderTerms(unitId: string, termIds: string[]): Promise<void> {
        await Promise.all(
            termIds.map((termId, index) =>
                this.repository.updateTerm(termId, { orderIndex: index }),
            ),
        );
    }

    /**
     * Import terms in bulk
     */
    async importTerms(unitId: string, terms: CreateVocabularyTermDto[]): Promise<void> {
        const unit = await this.repository.findUnitById(unitId);
        if (!unit) {
            throw new NotFoundException(`Unit with ID ${unitId} not found`);
        }

        const startIndex = unit.termCount;

        const termsData = terms.map((dto, index) => ({
            unitId,
            word: dto.word,
            definition: dto.definition,
            pronunciation: dto.pronunciation,
            partOfSpeech: dto.partOfSpeech,
            audioUrl: dto.audioUrl,
            imageUrl: dto.imageUrl,
            examples: dto.examples as Prisma.JsonValue,
            synonyms: dto.synonyms || [],
            antonyms: dto.antonyms || [],
            ipaUs: dto.ipaUs,
            ipaUk: dto.ipaUk,
            translationVi: dto.translationVi,
            orderIndex: startIndex + index,
            difficulty: dto.difficulty || 'beginner',
        }));

        await this.repository.createManyTerms(termsData);

        // Update unit and list stats
        await this.repository.updateUnit(unitId, {
            termCount: { increment: terms.length },
        });

        await this.repository.updateList(unit.listId, {
            totalTerms: { increment: terms.length },
        });
    }
}



