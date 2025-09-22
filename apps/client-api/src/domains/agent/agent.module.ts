import { Module } from '@nestjs/common';
import { SwaggerService } from '../swagger/swagger.service';
import { IntelligentController } from './agent.controller';
import { AgentService } from './agent.service';
import { GeminiService } from './service/gemini.service';
import { LangChainAgentService } from './service/langchain-agent.service';
import { RagService } from './service/rag.service';
import { SqlService } from './service/sql.service';
import { ApiSearchTool } from './tools/api-search.tool';
import { RagTool } from './tools/rag.tool';

@Module({
  controllers: [IntelligentController],
  providers: [
    AgentService,
    LangChainAgentService,
    RagService,
    SqlService,
    GeminiService,
    ApiSearchTool,
    RagTool,
    SwaggerService,
  ],
})
export class AgentModule {}
