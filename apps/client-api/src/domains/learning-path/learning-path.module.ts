import { SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { LearningPathController } from './controller/learning-path.controller';
import {
  LearningPathRepository,
  SkillProgressRepository,
  ActivityVariantRepository,
} from './repository';
import { LearningPathGenerationService } from './service/learning-path-generation.service';
import { LearningPathService } from './service/learning-path.service';
import { FeatureFlagService } from './service/feature-flag.service';
import { ActivityGeneratorService } from './service/activity-generator.service';
import { PromptTemplateService } from './service/prompt-template.service';
import { ContentValidationService } from './service/content-validation.service';
import { SRSSchedulerService } from './service/srs-scheduler.service';
import { MasteryGateService } from './service/mastery-gate.service';
import { DifficultyAdjusterService } from './service/difficulty-adjuster.service';
import { PerformanceTrackerService } from './service/performance-tracker.service';
import { Neo4jGraphService } from './service/neo4j-graph.service';
import { PrerequisiteService } from './service/prerequisite.service';
import { LearningPathGateway } from './gateway/learning-path.gateway';

@Module({
  imports: [AgentModule, SharedModule],
  controllers: [LearningPathController],
  providers: [
    // Services
    LearningPathService,
    LearningPathGenerationService,
    FeatureFlagService,

    // Phase 2: AI Content Generation Services
    ActivityGeneratorService,
    PromptTemplateService,
    ContentValidationService,

    // Phase 3: Adaptive Learning Engine Services
    SRSSchedulerService,
    MasteryGateService,
    DifficultyAdjusterService,
    PerformanceTrackerService,
    Neo4jGraphService,
    PrerequisiteService,

    // Phase 5: WebSocket Gateway
    LearningPathGateway,

    // Repositories
    LearningPathRepository,
    SkillProgressRepository,
    ActivityVariantRepository,
  ],
  exports: [
    // Export services
    LearningPathService,
    LearningPathGenerationService,
    FeatureFlagService,

    // Phase 2: Export AI services
    ActivityGeneratorService,
    PromptTemplateService,
    ContentValidationService,

    // Phase 3: Export Adaptive Learning services
    SRSSchedulerService,
    MasteryGateService,
    DifficultyAdjusterService,
    PerformanceTrackerService,
    Neo4jGraphService,
    PrerequisiteService,

    // Phase 5: Export WebSocket Gateway
    LearningPathGateway,

    // Export repositories for use by other modules
    LearningPathRepository,
    SkillProgressRepository,
    ActivityVariantRepository,
  ],
})
export class LearningPathModule {}
