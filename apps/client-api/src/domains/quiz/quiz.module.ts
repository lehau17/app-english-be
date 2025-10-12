import { Module } from '@nestjs/common';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { QuizController } from './controller/quiz.controller';
import { QuizService } from './service/quiz.service';
import { VocabularyModule } from '../vocabulary';

@Module({
  imports: [DictionaryModule, VocabularyModule],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule {}
