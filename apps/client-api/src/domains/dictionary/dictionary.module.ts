import { RedisModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DictionaryController } from './controller/dictionary.controller';
import { DictionaryService } from './service/dictionary.service';
import { WordOfTheDayService } from './service/word-of-the-day.service';
import { WordsApiService } from './service/words-api.service';

@Module({
  imports: [ConfigModule, RedisModule],
  controllers: [DictionaryController],
  providers: [DictionaryService, WordsApiService, WordOfTheDayService],
  exports: [DictionaryService, WordOfTheDayService],
})
export class DictionaryModule {}
