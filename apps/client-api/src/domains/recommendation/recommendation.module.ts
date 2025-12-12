import { SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { RecommendationController } from './controller/recommendation.controller';
import { RecommendationRepository } from './repository/recommendation.repository';
import { RecommendationGenerationService } from './service/recommendation-generation.service';
import { RecommendationService } from './service/recommendation.service';

@Module({
  imports: [AgentModule, SharedModule],
  controllers: [RecommendationController],
  providers: [RecommendationService, RecommendationRepository, RecommendationGenerationService],
  exports: [RecommendationService, RecommendationGenerationService],
})
export class RecommendationModule {}







