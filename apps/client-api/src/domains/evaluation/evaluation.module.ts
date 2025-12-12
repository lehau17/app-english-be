import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from '../agent/agent.module';
import { AiEvaluationController } from './controller/ai-evaluation.controller';
import { EvaluationService } from './service/evaluation.service';

@Module({
  imports: [ConfigModule, DatabaseModule, AgentModule],
  controllers: [AiEvaluationController],
  providers: [EvaluationService],
})
export class EvaluationModule {}
