import { Module } from '@nestjs/common';
import { VocabularyRepository } from './repository/vocabulary.repository';
import { VocabularyController } from './controller/vocabulary.controller';
import { VocabularyService } from './service/vocabulary.service';

@Module({
  imports: [],
  controllers: [VocabularyController],
  providers: [VocabularyService, VocabularyRepository],
  exports: [VocabularyService],
})
export class VocabularyModule {}