
import { DatabaseModule } from '@app/database';
import { AiModule, SharedModule, TtsService } from '@app/shared';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BackgroundWorkerController } from './background-worker.controller';
import { BackgroundWorkerService } from './background-worker.service';
import { ClassroomSessionCron } from './classroom/classroom-session.cron';
import { DashboardModule } from './dashboard/dashboard.module';
import { LeaderboardWorkerModule } from './leaderboard/leaderboard.module';
import { SuggestionEngineModule } from './suggestion-engine/suggestion-engine.module';
import { Neo4jSyncListener } from './neo4j/neo4j-sync.listener';
import { PodcastGenerationService } from './podcast/podcast-generation.service';
import { PodcastCron } from './podcast/podcast.cron';
import { BackgroundWorkerUploadService } from './services/upload.service';
import { TtsListener } from './tts/tts.listener';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SharedModule,
    AiModule,
    DashboardModule,
    ScheduleModule.forRoot(),
    LeaderboardWorkerModule,
    SuggestionEngineModule,
  ],
  controllers: [BackgroundWorkerController],
  providers: [
    BackgroundWorkerService,
    // KafkaJS Listeners (replaced NestJS @MessagePattern)
    TtsListener,
    Neo4jSyncListener,
    // Existing services
    PodcastGenerationService,
    PodcastCron,
    ClassroomSessionCron,
    {
      provide: TtsService,
      useFactory: (uploadService: BackgroundWorkerUploadService) => {
        return new TtsService(uploadService);
      },
      inject: [BackgroundWorkerUploadService],
    },
    BackgroundWorkerUploadService,
  ],
})
export class BackgroundWorkerModule {}
