import { AiModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { LearningPathService } from './service/learning-path.service';
import { AgentChatRepository } from './repository/agent-chat.repository';
import { LearningPathController } from './controller/learning-path.controller';

@Module({
  imports: [AiModule],
  controllers: [AgentController, LearningPathController],
  providers: [
    AgentService,
    LearningPathService,
    AgentChatRepository,
  ],
  exports: [
    AgentService,
    LearningPathService,
  ],
})
export class AgentModule {}
