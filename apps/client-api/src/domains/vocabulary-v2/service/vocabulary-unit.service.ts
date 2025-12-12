import { GeminiService } from '@app/shared';
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
  constructor(
    private readonly repository: VocabularyRepository,
    private readonly geminiService: GeminiService,
  ) {}

  /**
   * Get AI suggestions for new unit
   */
  async suggestUnit(
    listId: string,
  ): Promise<{ suggestions: Array<{ title: string; description: string }> }> {
    // Get list info
    const list = await this.repository.findListById(listId, true);
    if (!list) {
      throw new NotFoundException(`List with ID ${listId} not found`);
    }

    // Get existing units
    const units = await this.repository.findUnitsByListId(listId, false);

    // Build metadata for AI
    const existingTitles = units.map((u) => u.title);
    const existingDescriptions = units
      .filter((u) => u.description)
      .map((u) => u.description);

    const prompt = `You are an expert English vocabulary curriculum designer. Generate 3 creative and pedagogically sound unit suggestions for a vocabulary list.

Vocabulary List Information:
- Title: ${list.title}
- Description: ${list.description || 'No description'}
- Language: ${list.language}
- Level: ${list.level || 'general'}
- Current number of units: ${list.totalUnits}
- Total terms: ${list.totalTerms}

${existingTitles.length > 0 ? `Existing Units (avoid duplication):\n${existingTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}` : 'This list has no units yet. Create foundational units.'}

Requirements:
1. Generate exactly 3 unit suggestions
2. Each unit should have:
   - A clear, descriptive title (3-10 words)
   - A brief description explaining what students will learn (20-50 words)
3. Units should be different from existing ones
4. Maintain logical progression (beginner → intermediate → advanced)
5. Tailor content to the list's theme and level
6. Use English for titles and descriptions

Return ONLY valid JSON in this exact format:
{
  "suggestions": [
    {"title": "Unit title 1", "description": "Unit description 1"},
    {"title": "Unit title 2", "description": "Unit description 2"},
    {"title": "Unit title 3", "description": "Unit description 3"}
  ]
}`;

    try {
      const response = await this.geminiService.generateResponse(prompt);

      // Try to extract JSON from response
      let jsonStr = response.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      // Parse and validate
      const parsed = JSON.parse(jsonStr);

      if (
        !parsed.suggestions ||
        !Array.isArray(parsed.suggestions) ||
        parsed.suggestions.length !== 3
      ) {
        throw new Error('Invalid response format from AI');
      }

      // Validate each suggestion
      for (const suggestion of parsed.suggestions) {
        if (!suggestion.title || !suggestion.description) {
          throw new Error('Each suggestion must have title and description');
        }
      }

      return parsed;
    } catch (error) {
      console.error('AI suggestion error:', error);

      // Fallback suggestions if AI fails
      return {
        suggestions: [
          {
            title: `Unit ${list.totalUnits + 1}: Core Concepts`,
            description: `Learn fundamental vocabulary related to ${list.title}. Build a strong foundation with essential terms.`,
          },
          {
            title: `Unit ${list.totalUnits + 2}: Practical Application`,
            description: `Apply your knowledge with real-world vocabulary. Practice common phrases and expressions.`,
          },
          {
            title: `Unit ${list.totalUnits + 3}: Advanced Topics`,
            description: `Expand your vocabulary with advanced terms and nuanced meanings. Master complex expressions.`,
          },
        ],
      };
    }
  }

  /**
   * Get all units in a list with user progress
   */
  async getUnits(
    listId: string,
    userId?: string,
  ): Promise<VocabularyUnitResponseDto[]> {
    const units = await this.repository.findUnitsByListId(listId, true); // Include terms

    // Optimization: Batch fetch all progress at once instead of N+1 queries
    let progressMap: Map<string, any> = new Map();
    if (userId) {
      const allTermIds = units.flatMap(
        (unit) => unit.terms?.map((term) => term.id) || [],
      );
      progressMap = await this.repository.findProgressBatch(userId, allTermIds);
    }

    // Calculate progress per unit using pre-fetched progress map
    return units.map((unit) => {
      let completedTerms = 0;

      if (userId && unit.terms) {
        completedTerms = unit.terms.filter((term) => {
          const progress = progressMap.get(term.id);
          // Count terms that have been reviewed at least once (any status except 'new')
          return (
            progress &&
            (progress.status === 'learning' ||
              progress.status === 'review' ||
              progress.status === 'mastered')
          );
        }).length;
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
    });
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
