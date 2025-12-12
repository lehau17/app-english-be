import { SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { LearningPathController } from './controller/learning-path.controller';
import { LearningPathRepository } from './repository/learning-path.repository';
import { LearningPathGenerationService } from './service/learning-path-generation.service';
import { LearningPathService } from './service/learning-path.service';

@Module({
  imports: [AgentModule, SharedModule],
  controllers: [LearningPathController],
  providers: [
    LearningPathService,
    LearningPathRepository,
    LearningPathGenerationService,
  ],
  exports: [LearningPathService, LearningPathGenerationService],
})
export class LearningPathModule {}
