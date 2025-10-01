import { DatabaseModule } from '@app/database';
import { AiModule, SharedModule, TtsService } from '@app/shared';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { BackgroundWorkerController } from './background-worker.controller';
import { BackgroundWorkerService } from './background-worker.service';
import { DashboardModule } from './dashboard/dashboard.module';
import { PodcastCron } from './podcast/podcast.cron';
import { PodcastGenerationService } from './podcast/podcast-generation.service';
import { ClassroomSessionCron } from './classroom/classroom-session.cron';
import { BackgroundWorkerUploadService } from './services/upload.service';
import { TtsProcessorService } from './tts/tts-processor.service';
import { LeaderboardWorkerModule } from './leaderboard/leaderboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SharedModule,
    AiModule,
    DashboardModule,
    ScheduleModule.forRoot(),
    LeaderboardWorkerModule,
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: process.env.KAFKA_BROKERS?.split(',') ?? [
              'localhost:19092',
            ],
          },
          consumer: {
            groupId: 'background-worker-consumer',
            allowAutoTopicCreation: true,
          },
        },
      },
    ]),
  ],
  controllers: [BackgroundWorkerController],
  providers: [
    BackgroundWorkerService,
    TtsProcessorService,
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
