import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { AiEvaluationController } from './controller/ai-evaluation.controller';
import { EvaluationService } from './service/evaluation.service';

@Module({
  imports: [DatabaseModule, AgentModule],
  controllers: [AiEvaluationController],
  providers: [EvaluationService],
})
export class EvaluationModule {}
