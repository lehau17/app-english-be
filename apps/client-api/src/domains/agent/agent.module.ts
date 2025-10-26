import { AiModule } from '@app/shared';
import { Neo4jModule } from '@app/shared/neo4j';
import { Module } from '@nestjs/common';
import { IntelligentController } from './agent.controller';
import { AgentService as AgentServiceTWi } from './agent.service';
import { PrivateAgentController } from './controller/private-agent.controller';
import { AgentChatRepository } from './repository';
import { AgentService } from './service';
import { AutoReindexService } from './service/auto-reindex.service';
import { GraphEntityService } from './service/graph-entity.service';
import { GraphRelationshipService } from './service/graph-relationship.service';
import { GraphTraversalService } from './service/graph-traversal.service';
import { LangChainAgentService } from './service/langchain-agent.service';
import { RagCacheService } from './service/rag-cache.service';
import { RagService } from './service/rag.service';
import { ReportGeneratorService } from './service/report-generator.service';
import { RerankerService } from './service/reranker.service';
import { SqlService } from './service/sql.service';
import { TextChunkerService } from './service/text-chunker.service';
import { ChartGeneratorTool } from './tools/chart-generator.tool';
import { ExcelExportTool } from './tools/excel-export.tool';
import { GraphQueryTool } from './tools/graph-query.tool';
import { PdfExportTool } from './tools/pdf-export.tool';
import { ReportAdvisorTool } from './tools/report-advisor.tool';
import { StudentAgentTools } from './tools/student-agent.tools';
import { WordExportTool } from './tools/word-export.tool';

@Module({
    imports: [AiModule, Neo4jModule],
    controllers: [IntelligentController, PrivateAgentController],
    providers: [
        AgentService,
        AgentServiceTWi,
        AgentChatRepository,
        AutoReindexService,
        LangChainAgentService,
        RagCacheService,
        TextChunkerService,
        RagService,
        RerankerService,
        ReportGeneratorService,
        SqlService,
        GraphEntityService,
        GraphRelationshipService,
        GraphTraversalService,
        ChartGeneratorTool,
        ExcelExportTool,
        PdfExportTool,
        WordExportTool,
        ReportAdvisorTool,
        GraphQueryTool,
        StudentAgentTools,
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
export class AgentModule { }
