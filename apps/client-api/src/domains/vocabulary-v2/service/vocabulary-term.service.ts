import { GeminiService } from '@app/shared';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GoogleTranslateFreeService } from '../../google-translate/google-translate.service';
import { MediaService } from '../../media/service/media.service';
import { UploadService } from '../../upload/upload.service';
import {
    CreateVocabularyTermDto,
    UpdateVocabularyTermDto,
    VocabularyTermResponseDto,
} from '../dto/vocabulary-term.dto';
import { VocabularyRepository } from '../repository/vocabulary.repository';

@Injectable()
export class VocabularyTermService {
  private readonly logger = new Logger(VocabularyTermService.name);

  constructor(
    private readonly repository: VocabularyRepository,
    private readonly geminiService: GeminiService,
    private readonly googleTranslateService: GoogleTranslateFreeService,
    private readonly uploadService: UploadService,
    private readonly mediaService?: MediaService,
  ) {}

  /**
   * Get all terms in a unit
   */
  async getTerms(
    unitId: string,
    userId?: string,
  ): Promise<VocabularyTermResponseDto[]> {
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
  async getTerm(
    termId: string,
    userId?: string,
  ): Promise<VocabularyTermResponseDto> {
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

    // Extract media from vocabulary term and create MediaFile records (async, non-blocking)
    if (this.mediaService) {
      this.extractMediaFromVocabularyTerm(term.id, dto, unitId).catch((error) => {
        this.logger.error(
          `Failed to extract media from vocabulary term ${term.id}: ${error.message}`,
          error,
        );
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
    if (dto.pronunciation !== undefined)
      updateData.pronunciation = dto.pronunciation;
    if (dto.partOfSpeech !== undefined)
      updateData.partOfSpeech = dto.partOfSpeech;
    if (dto.audioUrl !== undefined) updateData.audioUrl = dto.audioUrl;
    if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;
    if (dto.examples !== undefined)
      updateData.examples = dto.examples as Prisma.JsonValue;
    if (dto.synonyms !== undefined) updateData.synonyms = dto.synonyms;
    if (dto.antonyms !== undefined) updateData.antonyms = dto.antonyms;
    if (dto.ipaUs !== undefined) updateData.ipaUs = dto.ipaUs;
    if (dto.ipaUk !== undefined) updateData.ipaUk = dto.ipaUk;
    if (dto.translationVi !== undefined)
      updateData.translationVi = dto.translationVi;
    if (dto.orderIndex !== undefined) updateData.orderIndex = dto.orderIndex;
    if (dto.difficulty !== undefined) updateData.difficulty = dto.difficulty;

    const updated = await this.repository.updateTerm(termId, updateData);

    // Extract media from updated vocabulary term and create MediaFile records (async, non-blocking)
    if (this.mediaService && (dto.imageUrl !== undefined || dto.audioUrl !== undefined)) {
      this.extractMediaFromVocabularyTerm(updated.id, {
        word: updated.word,
        definition: updated.definition,
        imageUrl: updated.imageUrl || undefined,
        audioUrl: updated.audioUrl || undefined,
      } as CreateVocabularyTermDto, updated.unitId).catch((error) => {
        this.logger.error(
          `Failed to extract media from updated vocabulary term ${updated.id}: ${error.message}`,
          error,
        );
      });
    }

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
   * AI suggest new terms for unit (check existing terms and generate new ones)
   */
  async suggestTerms(
    unitId: string,
  ): Promise<{ suggestions: Array<{ word: string; hint: string }> }> {
    // Get unit and list info
    const unit = await this.repository.findUnitById(unitId, true);
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${unitId} not found`);
    }

    const list = await this.repository.findListById(unit.listId);
    if (!list) {
      throw new NotFoundException(`List not found`);
    }

    // Get existing terms
    const existingTerms = unit.terms || [];
    const existingWords = existingTerms.map((t) => t.word.toLowerCase());

    const prompt = `You are an expert English vocabulary educator. Suggest 3-5 NEW vocabulary words for this unit.

Unit Information:
- Unit Title: ${unit.title}
- Unit Description: ${unit.description || 'No description'}
- List Title: ${list.title}
- List Level: ${list.level || 'general'}
- Language: ${list.language}
- Current term count: ${unit.termCount}

${existingWords.length > 0 ? `Existing Words (DO NOT suggest these):\n${existingWords.join(', ')}` : 'This unit has no terms yet. Suggest foundational words.'}

Requirements:
1. Generate 3-5 word suggestions
2. Each suggestion must be NEW and NOT in the existing words list
3. Words should fit the unit theme and level
4. For each word, provide a brief hint (5-10 words) about what it means
5. Maintain difficulty progression

Return ONLY valid JSON:
{
  "suggestions": [
    {"word": "word1", "hint": "brief description of meaning"},
    {"word": "word2", "hint": "brief description of meaning"},
    ...
  ]
}`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      let jsonStr = response.trim();

      // Remove markdown code blocks
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonStr);

      if (
        !parsed.suggestions ||
        !Array.isArray(parsed.suggestions) ||
        parsed.suggestions.length === 0
      ) {
        throw new Error('Invalid AI response');
      }

      // Validate and filter out duplicates
      const validSuggestions = parsed.suggestions.filter((s: any) => {
        return (
          s.word &&
          s.hint &&
          !existingWords.includes(s.word.toLowerCase())
        );
      });

      return { suggestions: validSuggestions.slice(0, 5) };
    } catch (error) {
      console.error('AI suggest terms error:', error);

      // Fallback suggestions
      return {
        suggestions: [
          { word: 'vocabulary', hint: 'words used in language' },
          { word: 'comprehension', hint: 'ability to understand' },
          { word: 'fluency', hint: 'smooth and effortless speech' },
        ],
      };
    }
  }

  /**
   * AI auto-complete term data from word + generate audio via Google TTS + upload to MinIO
   */
  async autoCompleteTerm(word: string): Promise<{
    word: string;
    definition: string;
    translationVi: string;
    pronunciation: string;
    partOfSpeech: string;
    synonyms: string[];
    antonyms: string[];
    examples: Array<{ sentence: string; translation: string }>;
    difficulty: string;
    audioUrl?: string;
  }> {
    const prompt = `You are an English dictionary and language expert. Provide comprehensive information about this word: "${word}"

Generate detailed and accurate information:
1. Definition (clear, concise English definition)
2. Vietnamese translation
3. IPA pronunciation (US)
4. Part of speech (noun, verb, adjective, etc.)
5. 2-3 synonyms
6. 2-3 antonyms (if applicable)
7. 2-3 example sentences with Vietnamese translations
8. Difficulty level (beginner, intermediate, advanced, expert)

Return ONLY valid JSON:
{
  "word": "${word}",
  "definition": "clear definition",
  "translationVi": "bản dịch tiếng Việt",
  "pronunciation": "/aɪ piː eɪ/",
  "partOfSpeech": "noun",
  "synonyms": ["synonym1", "synonym2"],
  "antonyms": ["antonym1", "antonym2"],
  "examples": [
    {"sentence": "Example sentence.", "translation": "Câu ví dụ."}
  ],
  "difficulty": "intermediate"
}`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      let jsonStr = response.trim();

      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const data = JSON.parse(jsonStr);

      // Generate audio using Google TTS and upload to MinIO
      let audioUrl: string | undefined;
      try {
        const audioResult =
          await this.googleTranslateService.createAudioWithUrl(word, 'en');
        audioUrl = audioResult.url; // This is the MinIO S3 URL
        console.log(`Generated and uploaded audio for "${word}": ${audioUrl}`);
      } catch (audioError) {
        console.error(` Failed to generate audio for "${word}":`, audioError);
        // Continue without audio
      }

      return {
        word: data.word || word,
        definition: data.definition || '',
        translationVi: data.translationVi || '',
        pronunciation: data.pronunciation || '',
        partOfSpeech: data.partOfSpeech || '',
        synonyms: data.synonyms || [],
        antonyms: data.antonyms || [],
        examples: data.examples || [],
        difficulty: data.difficulty || 'intermediate',
        audioUrl,
      };
    } catch (error) {
      console.error('AI auto-complete error:', error);
      throw new Error('Failed to auto-complete term data');
    }
  }

  /**
   * AI bulk generate and create multiple terms (1-10) at once
   */
  async bulkGenerateTerms(
    unitId: string,
    count: number,
  ): Promise<{ created: number; terms: VocabularyTermResponseDto[] }> {
    // Validate count
    const termCount = Math.min(Math.max(1, count), 10); // Clamp between 1-10

    // Get unit info
    const unit = await this.repository.findUnitById(unitId, true);
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${unitId} not found`);
    }

    const list = await this.repository.findListById(unit.listId);
    if (!list) {
      throw new NotFoundException(`List not found`);
    }

    // Get existing terms to avoid duplicates
    const existingTerms = unit.terms || [];
    const existingWords = existingTerms.map((t) => t.word.toLowerCase());

    const prompt = `You are an expert English vocabulary educator. Generate ${termCount} complete vocabulary terms for this unit.

Unit Information:
- Unit Title: ${unit.title}
- Unit Description: ${unit.description || 'No description'}
- List Title: ${list.title}
- List Level: ${list.level || 'general'}
- Language: ${list.language}
- Current term count: ${unit.termCount}

${existingWords.length > 0 ? `Existing Words (DO NOT use these):\n${existingWords.join(', ')}` : 'This unit has no terms yet.'}

Requirements:
1. Generate exactly ${termCount} complete terms
2. Each term must be NEW and NOT in existing words
3. For EACH term, provide:
   - word (the vocabulary word)
   - definition (clear English definition)
   - translationVi (Vietnamese translation)
   - pronunciation (IPA format)
   - partOfSpeech (noun/verb/adjective/etc)
   - synonyms (array of 2-3 words)
   - antonyms (array of 1-2 words, can be empty)
   - examples (array of 2 objects with "sentence" and "translation")
   - difficulty (beginner/intermediate/advanced/expert)
4. Words should fit unit theme and progress in difficulty

Return ONLY valid JSON:
{
  "terms": [
    {
      "word": "vocabulary",
      "definition": "words used in language",
      "translationVi": "từ vựng",
      "pronunciation": "/vəˈkæbjʊləri/",
      "partOfSpeech": "noun",
      "synonyms": ["lexicon", "terminology"],
      "antonyms": [],
      "examples": [
        {"sentence": "Build your vocabulary.", "translation": "Xây dựng vốn từ vựng."}
      ],
      "difficulty": "intermediate"
    }
  ]
}`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      let jsonStr = response.trim();

      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonStr);

      if (!parsed.terms || !Array.isArray(parsed.terms)) {
        throw new Error('Invalid AI response format');
      }

      // Filter valid terms and avoid duplicates
      const validTerms = parsed.terms
        .filter((t: any) => {
          return (
            t.word &&
            t.definition &&
            !existingWords.includes(t.word.toLowerCase())
          );
        })
        .slice(0, termCount);

      if (validTerms.length === 0) {
        throw new Error('AI generated no valid terms');
      }

      // Create terms with audio generation
      const createdTerms: VocabularyTermResponseDto[] = [];

      for (let i = 0; i < validTerms.length; i++) {
        const termData = validTerms[i];

        // Generate audio for this term
        let audioUrl: string | undefined;
        try {
          const audioResult =
            await this.googleTranslateService.createAudioWithUrl(
              termData.word,
              'en',
            );
          audioUrl = audioResult.url;
          console.log(
            `Generated audio ${i + 1}/${validTerms.length} for "${termData.word}"`,
          );
        } catch (audioError) {
          console.error(
            ` Failed to generate audio for "${termData.word}":`,
            audioError,
          );
        }

        // Create term in database
        const createDto: CreateVocabularyTermDto = {
          word: termData.word,
          definition: termData.definition,
          translationVi: termData.translationVi || undefined,
          pronunciation: termData.pronunciation || undefined,
          partOfSpeech: termData.partOfSpeech || undefined,
          audioUrl: audioUrl || undefined,
          synonyms: termData.synonyms || [],
          antonyms: termData.antonyms || [],
          examples: termData.examples || [],
          difficulty: termData.difficulty || 'intermediate',
          orderIndex: unit.termCount + i,
        };

        const created = await this.createTerm(unitId, createDto);
        createdTerms.push(created);
      }

      return {
        created: createdTerms.length,
        terms: createdTerms,
      };
    } catch (error) {
      console.error('AI bulk generate error:', error);
      throw new Error(
        `Failed to bulk generate terms: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Import terms in bulk
   */
  async importTerms(
    unitId: string,
    terms: CreateVocabularyTermDto[],
  ): Promise<void> {
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

  /**
   * Extract media from vocabulary term and create MediaFile records
   */
  private async extractMediaFromVocabularyTerm(
    termId: string,
    dto: CreateVocabularyTermDto,
    unitId: string,
  ): Promise<void> {
    if (!this.mediaService) return;

    this.logger.log(`Extracting media from vocabulary term ${termId}`);

    const mediaUrls: Array<{ url: string }> = [];

    if (dto.imageUrl) {
      mediaUrls.push({ url: dto.imageUrl });
    }
    if (dto.audioUrl) {
      mediaUrls.push({ url: dto.audioUrl });
    }

    // Create MediaFile for each media URL
    await Promise.allSettled(
      mediaUrls.map(async ({ url }) => {
        try {
          await this.mediaService.createFromContext(url, {
            source: 'vocabulary_term',
            sourceId: termId,
            word: dto.word,
            definition: dto.definition,
            unitId: unitId,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to create MediaFile for URL ${url} in vocabulary term ${termId}: ${error.message}`,
          );
        }
      }),
    );
  }
}
