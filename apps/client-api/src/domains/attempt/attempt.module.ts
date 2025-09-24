import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { GeminiService } from '../agent/service/gemini.service';
import { PrivateAttemptController } from './controller';
import { AttemptRepository } from './repository';
import { AttemptService } from './service';

@Module({
  imports: [AgentModule],
  controllers: [PrivateAttemptController],
  providers: [AttemptService, AttemptRepository, GeminiService],
})
export class AttemptModule {}
