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
import { GuestChatService } from './service/guest-chat.service';
import { LandingConsultantService } from './service/landing-consultant.service';
import { LangChainAgentService } from './service/langchain-agent.service';
import { ParentAgentService } from './service/parent-agent.service';
import { RagCacheService } from './service/rag-cache.service';
import { RagService } from './service/rag.service';
import { ReportGeneratorService } from './service/report-generator.service';
import { RerankerService } from './service/reranker.service';
import { SqlService } from './service/sql.service';
import { StudentAgentService } from './service/student-agent.service';
import { TextChunkerService } from './service/text-chunker.service';
import { AssignmentAnalyticsTool } from './tools/assignment-analytics.tool';
import { AttendanceReportTool } from './tools/attendance-report.tool';
import { ChartGeneratorTool } from './tools/chart-generator.tool';
import { ClassPerformanceTool } from './tools/class-performance.tool';
import { ClassroomAnalyticsTool } from './tools/classroom-analytics.tool';
import { ContentStatsTool } from './tools/content-stats.tool';
import { CourseAnalyticsTool } from './tools/course-analytics.tool';
import { ExcelExportTool } from './tools/excel-export.tool';
import { FlashcardReviewTool } from './tools/flashcard-review.tool';
import { GrammarExplainerTool } from './tools/grammar-explainer.tool';
import { GraphQueryTool } from './tools/graph-query.tool';
import { NotificationSenderTool } from './tools/notification-sender.tool';
import { ParentAgentTools } from './tools/parent-agent.tools';
import { PaymentTrackerTool } from './tools/payment-tracker.tool';
import { PdfExportTool } from './tools/pdf-export.tool';
import { PodcastHistoryTool } from './tools/podcast-history.tool';
import { ProgressTrackerTool } from './tools/progress-tracker.tool';
import { ReportAdvisorTool } from './tools/report-advisor.tool';
import { RevenueAnalyticsTool } from './tools/revenue-analytics.tool';
import { SpeakingProgressTool } from './tools/speaking-progress.tool';
import { StudentAgentTools } from './tools/student-agent.tools';
import { StudentAlertTool } from './tools/student-alert.tool';
import { StudentAnalyticsTool } from './tools/student-analytics.tool';
import { SystemOverviewTool } from './tools/system-overview.tool';
import { TeacherAnalyticsTool } from './tools/teacher-analytics.tool';
import { UpcomingDeadlinesTool } from './tools/upcoming-deadlines.tool';
import { UserManagementTool } from './tools/user-management.tool';
import { VocabularyLookupTool } from './tools/vocabulary-lookup.tool';
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
    LandingConsultantService,
    GuestChatService,
    RagCacheService,
    TextChunkerService,
    RagService,
    RerankerService,
    ReportGeneratorService,
    SqlService,
    GraphEntityService,
    GraphRelationshipService,
    GraphTraversalService,
    StudentAgentService,
    ParentAgentService,
    ChartGeneratorTool,
    ExcelExportTool,
    PdfExportTool,
    WordExportTool,
    ReportAdvisorTool,
    GraphQueryTool,
    StudentAgentTools,
    ParentAgentTools,
    StudentAnalyticsTool,
    TeacherAnalyticsTool,
    CourseAnalyticsTool,
    ClassroomAnalyticsTool,
    ClassPerformanceTool,
    RevenueAnalyticsTool,
    SystemOverviewTool,
    NotificationSenderTool,
    AssignmentAnalyticsTool,
    ProgressTrackerTool,
    PodcastHistoryTool,
    StudentAlertTool,
    UserManagementTool,
    ContentStatsTool,
    VocabularyLookupTool,
    GrammarExplainerTool,
    FlashcardReviewTool,
    UpcomingDeadlinesTool,
    AttendanceReportTool,
    SpeakingProgressTool,
    PaymentTrackerTool,
  ],
  exports: [
    AgentService,
    AgentServiceTWi,
    AgentChatRepository,
    AiModule,
    AutoReindexService,
    RagService,
    LangChainAgentService,
    StudentAnalyticsTool,
  ],
})
export class AgentModule {}
