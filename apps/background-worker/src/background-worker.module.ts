import { DatabaseModule } from '@app/database';
import { AiModule, SharedModule, TtsService } from '@app/shared';
import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ClassroomModule } from '../../client-api/src/domains/classroom/classroom.module';
import { BackgroundWorkerController } from './background-worker.controller';
import { BackgroundWorkerService } from './background-worker.service';
import { ClassroomSessionCron } from './classroom/classroom-session.cron';
import { ClassroomStatusCron } from './classroom/classroom-status.cron';
import { DashboardModule } from './dashboard/dashboard.module';
import { EmailListener } from './email/email.listener';
import { EmailService } from './email/email.service';
import { LeaderboardWorkerModule } from './leaderboard/leaderboard.module';
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
    MailerModule.forRootAsync({
      useFactory: () => ({
        transport: {
          host: process.env.SMTP_HOST,
          port: +process.env.SMTP_PORT,
          secure: false,
          auth: process.env.SMTP_USER
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
          tls: {
            rejectUnauthorized: false,
          },
        },
        defaults: {
          from: process.env.SMTP_FROM || 'noreply@english-learning.com',
        },
        template: {
          dir: __dirname + '/email/templates',
          adapter: new PugAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  controllers: [BackgroundWorkerController],
  providers: [
    BackgroundWorkerService,
    // KafkaJS Listeners (replaced NestJS @MessagePattern)
    TtsListener,
    Neo4jSyncListener,
    EmailListener,
    // Email service
    EmailService,
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
