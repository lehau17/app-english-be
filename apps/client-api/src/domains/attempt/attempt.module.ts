import { AiModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { PrivateAttemptController } from './controller';
import { AttemptRepository } from './repository';
import { AttemptService } from './service';

@Module({
  imports: [AgentModule, AiModule],
  controllers: [PrivateAttemptController],
  providers: [AttemptService, AttemptRepository],
})
export class AttemptModule {}
