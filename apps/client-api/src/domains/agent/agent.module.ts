import { Module } from '@nestjs/common';
import { IntelligentController } from './agent.controller';
import { AgentService } from './agent.service';
import { GeminiService } from './service/gemini.service';
import { LangChainAgentService } from './service/langchain-agent.service';
import { RagService } from './service/rag.service';
import { SqlService } from './service/sql.service';

@Module({
  controllers: [IntelligentController],
  providers: [AgentService, LangChainAgentService, RagService, SqlService, GeminiService, ],
})
export class AgentModule {}
