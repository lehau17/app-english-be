import { AiModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { IntelligentController } from './agent.controller';
import { AgentService as AgentServiceTWi } from './agent.service';
import { PrivateAgentController } from './controller/private-agent.controller';
import { AgentChatRepository } from './repository';
import { AgentService } from './service';
import { AutoReindexService } from './service/auto-reindex.service';
import { LangChainAgentService } from './service/langchain-agent.service';
import { RagService } from './service/rag.service';
import { SqlService } from './service/sql.service';
import { ChartGeneratorTool } from './tools/chart-generator.tool';
import { ExcelExportTool } from './tools/excel-export.tool';

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
    ChartGeneratorTool,
    ExcelExportTool,
  ],
  exports: [
    AgentService,
    AgentServiceTWi,
    AgentChatRepository,
    AiModule,
    AutoReindexService,
    RagService,
    LangChainAgentService,
  ],
})
export class AgentModule {}
