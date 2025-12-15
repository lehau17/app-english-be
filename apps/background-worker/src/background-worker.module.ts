import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { BackgroundWorkerController } from './background-worker.controller';
import { BackgroundWorkerService } from './background-worker.service';
import { DashboardModule } from './dashboard/dashboard.module';
import { LeaderboardWorkerModule } from './leaderboard/leaderboard.module';
import { TopicsModule } from './topics/topics.module';
import { SpeakingPracticeModule } from './speaking-practice/speaking-practice.module';

@Module({
  imports: [
    DatabaseModule,
    SharedModule,
    ScheduleModule.forRoot(),
    DashboardModule,
    LeaderboardWorkerModule,
    TopicsModule,
    SpeakingPracticeModule,
  ],
  controllers: [BackgroundWorkerController],
  providers: [BackgroundWorkerService],
})
export class BackgroundWorkerModule {}
