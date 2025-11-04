import { DatabaseModule } from '@app/database';
import { AiModule, SharedModule, TtsService } from '@app/shared';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ClassroomModule } from '../../client-api/src/domains/classroom/classroom.module';
import { BackgroundWorkerController } from './background-worker.controller';
import { BackgroundWorkerService } from './background-worker.service';
import { ClassroomSessionCron } from './classroom/classroom-session.cron';
import { ClassroomStatusCron } from './classroom/classroom-status.cron';
import { DashboardModule } from './dashboard/dashboard.module';
import { LeaderboardWorkerModule } from './leaderboard/leaderboard.module';
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
    ClassroomModule,
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
    ClassroomStatusCron,
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
