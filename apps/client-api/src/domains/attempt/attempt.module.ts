import { Module } from '@nestjs/common';
import { PrivateAttemptController } from './controller';
import { AttemptService } from './service';
import { AttemptRepository } from './repository';

@Module({
  controllers: [PrivateAttemptController],
  providers: [AttemptService, AttemptRepository],
})
export class AttemptModule {}
