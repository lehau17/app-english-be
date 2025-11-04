import { Global, Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { RedisModule } from '../redis';
import { ProfanityBanService } from './profanity-ban.service';
import { ProfanityDetectionService } from './profanity-detection.service';

@Global()
@Module({
  imports: [AiModule, RedisModule],
  providers: [ProfanityDetectionService, ProfanityBanService],
  exports: [ProfanityDetectionService, ProfanityBanService],
})
export class ProfanityModule {}
