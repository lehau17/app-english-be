import { DatabaseModule, PrismaRepository } from '@app/database';
import { Module } from '@nestjs/common';
import { VocabularyStatsCron } from './vocabulary-stats.cron';
import { VocabularyStatsService } from './vocabulary-stats.service';
import { VocabularyRepository } from './vocabulary.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    VocabularyRepository,
    VocabularyStatsService,
    VocabularyStatsCron,
    PrismaRepository,
  ],
  exports: [VocabularyStatsService],
})
export class VocabularyModule {}
