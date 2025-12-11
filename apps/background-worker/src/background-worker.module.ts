import { DatabaseModule } from '@app/database';
import { AiModule, SharedModule, TtsService } from '@app/shared';
import { AutoCertificateIssuerService } from '@app/shared/certificate';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ClassroomModule } from '../../client-api/src/domains/classroom/classroom.module';
import { BackgroundWorkerController } from './background-worker.controller';
import { BackgroundWorkerService } from './background-worker.service';
import { CertificateIssuanceCron } from './certificate/certificate-issuance.cron';
import { CertificateIssuanceService } from './certificate/certificate-issuance.service';
import { ClassroomSessionCron } from './classroom/classroom-session.cron';
import { ClassroomStatusCron } from './classroom/classroom-status.cron';
import { DashboardModule } from './dashboard/dashboard.module';
import { LeaderboardWorkerModule } from './leaderboard/leaderboard.module';
import { MediaProcessingListener } from './media/media-processing.listener';
import { MediaProcessorService } from './media/media-processor.service';
import { Neo4jSyncListener } from './neo4j/neo4j-sync.listener';
import { PodcastGenerationService } from './podcast/podcast-generation.service';
import { PodcastCron } from './podcast/podcast.cron';
import { BackgroundWorkerUploadService } from './services/upload.service';
import { TtsListener } from './tts/tts.listener';
import { VocabularyModule } from './vocabulary/vocabulary.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({ isGlobal: true }),
    SharedModule,
    AiModule,
    DashboardModule,
    ScheduleModule.forRoot(),
    LeaderboardWorkerModule,
    ClassroomModule,
    VocabularyModule,
  ],
  controllers: [BackgroundWorkerController],
  providers: [
    BackgroundWorkerService,
    // KafkaJS Listeners (replaced NestJS @MessagePattern)
    TtsListener,
    Neo4jSyncListener,
    MediaProcessingListener,
    MediaProcessorService,
    // Existing services
    PodcastGenerationService,
    PodcastCron,
    ClassroomSessionCron,
    ClassroomStatusCron,
    CertificateIssuanceCron,
    CertificateIssuanceService,
    // Provide ICertificateIssuer for AutoCertificateIssuerService
    {
      provide: 'ICertificateIssuer',
      useExisting: CertificateIssuanceService,
    },
    // Provide AutoCertificateIssuerService here where ICertificateIssuer is available
    AutoCertificateIssuerService,
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
