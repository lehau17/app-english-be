import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SavedWord } from '@prisma/client';
import { VocabularyRepository } from '../repository/vocabulary.repository';

@Injectable()
export class VocabularyService {
  constructor(private readonly vocabularyRepository: VocabularyRepository) {}

  async saveWord(userId: string, word: string): Promise<SavedWord> {
    const normalizedWord = word.toLowerCase().trim();
    if (!normalizedWord) {
      throw new ConflictException('Word cannot be empty.');
    }

    const existingWord = await this.vocabularyRepository.findOne(
      userId,
      normalizedWord,
    );
    if (existingWord) {
      throw new ConflictException(
        `Word "${word}" is already in your vocabulary.`,
      );
    }

    return this.vocabularyRepository.create(userId, normalizedWord);
  }

  async getSavedWords(userId: string): Promise<SavedWord[]> {
    return this.vocabularyRepository.findByUserId(userId);
  }

  async deleteWord(userId: string, word: string): Promise<void> {
    const normalizedWord = word.toLowerCase().trim();
    const existingWord = await this.vocabularyRepository.findOne(
      userId,
      normalizedWord,
    );
    if (!existingWord) {
      throw new NotFoundException(
        `Word "${word}" not found in your vocabulary.`,
      );
    }

    await this.vocabularyRepository.delete(userId, normalizedWord);
  }
}
