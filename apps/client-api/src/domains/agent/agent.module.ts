import { AiModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { SwaggerService } from '../swagger/swagger.service';
import { IntelligentController } from './agent.controller';
import { AgentService as AgentServiceTWi } from './agent.service';
import { PrivateAgentController } from './controller/private-agent.controller';
import { AgentChatRepository } from './repository';
import { AgentService } from './service';
import { AutoReindexService } from './service/auto-reindex.service';
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
    AgentChatRepository,
    AutoReindexService,
    LangChainAgentService,
    RagService,
    SqlService,
    ApiSearchTool,
    SwaggerService,
  ],
  exports: [
    AgentService,
    AgentServiceTWi,
    AgentChatRepository,
    AiModule,
    AutoReindexService,
    RagService,
    LangChainAgentService,
  ], // Export services for other modules
})
export class AgentModule {}
