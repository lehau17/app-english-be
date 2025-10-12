import { DictionaryService } from '@app/client-api/src/domains/dictionary/service/dictionary.service';
import { VocabularyService } from '@app/client-api/src/domains/vocabulary/service/vocabulary.service';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { FlashcardDto, QuizDto, QuizQuestionDto } from '../dto/quiz.dto';

@Injectable()
export class QuizService {
  constructor(
    private readonly vocabularyService: VocabularyService,
    private readonly dictionaryService: DictionaryService,
  ) {}

  async generateQuiz(
    userId: string,
    numberOfQuestions = 10,
  ): Promise<QuizDto> {
    const savedWords = await this.vocabularyService.getSavedWords(userId);
    if (savedWords.length < 4) {
      throw new InternalServerErrorException(
        'Not enough words in vocabulary to generate a quiz. Minimum 4 words required.',
      );
    }

    const quizWords = this.shuffleArray(savedWords).slice(0, numberOfQuestions);
    const questions: QuizQuestionDto[] = [];

    for (const savedWord of quizWords) {
      const wordDetails = await this.dictionaryService.lookupWord(
        savedWord.word,
      );
      const correctAnswer =
        wordDetails.definitions[0]?.definition || 'No definition found.';

      // Get 3 other random definitions
      const otherWords = savedWords.filter((w) => w.word !== savedWord.word);
      const randomWords = this.shuffleArray(otherWords).slice(0, 3);

      const wrongAnswers: string[] = [];
      for (const randomWord of randomWords) {
        const randomWordDetails = await this.dictionaryService.lookupWord(
          randomWord.word,
        );
        wrongAnswers.push(
          randomWordDetails.definitions[0]?.definition ||
            `A definition for ${randomWord.word}`,
        );
      }

      const options = this.shuffleArray([correctAnswer, ...wrongAnswers]);

      questions.push({
        questionWord: savedWord.word,
        options,
        correctAnswer,
      });
    }

    return { questions };
  }

  async getFlashcards(userId: string): Promise<FlashcardDto[]> {
    const savedWords = await this.vocabularyService.getSavedWords(userId);
    const flashcards: FlashcardDto[] = [];

    for (const savedWord of savedWords) {
      const details = await this.dictionaryService.lookupWord(savedWord.word);
      flashcards.push({
        word: details.word,
        pronunciation: details.pronunciation,
        definition: details.definitions[0]?.definition,
        example: details.definitions[0]?.example,
        audioUrl: details.audioUrl,
      });
    }

    return flashcards;
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}