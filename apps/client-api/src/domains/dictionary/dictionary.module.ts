import { RedisModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DictionaryController } from './controller/dictionary.controller';
import { WordsApiService } from './service/words-api.service';
import { DictionaryService } from './service/dictionary.service';

@Module({
  imports: [ConfigModule, RedisModule],
  controllers: [DictionaryController],
  providers: [DictionaryService, WordsApiService],
  exports: [DictionaryService],
})
export class DictionaryModule {}
