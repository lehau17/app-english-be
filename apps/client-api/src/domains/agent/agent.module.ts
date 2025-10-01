import { AiModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { SwaggerService } from '../swagger/swagger.service';
import { IntelligentController } from './agent.controller';
import { AgentService as AgentServiceTWi } from './agent.service';
import { PrivateAgentController } from './controller/private-agent.controller';
import { AgentService } from './service';
import { LangChainAgentService } from './service/langchain-agent.service';
import { RagService } from './service/rag.service';
import { SqlService } from './service/sql.service';
import { ApiSearchTool } from './tools/api-search.tool';

@Module({
  imports: [AiModule],
  controllers: [IntelligentController, PrivateAgentController],
  providers: [
    AgentService,
    AgentServiceTWi,
    LangChainAgentService,
    RagService,
    SqlService,
    ApiSearchTool,
    SwaggerService,
  ],
  exports: [
    AgentService,
    AgentServiceTWi,
    AiModule,
    RagService,
    LangChainAgentService,
  ], // Export services for other modules
})
export class AgentModule {}
