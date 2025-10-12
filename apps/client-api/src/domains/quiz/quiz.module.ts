import { Module } from '@nestjs/common';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { VocabularyModule } from '../vocabulary';
import { QuizController } from './controller/quiz.controller';
import { QuizService } from './service/quiz.service';

@Module({
  imports: [DictionaryModule, VocabularyModule],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule {}