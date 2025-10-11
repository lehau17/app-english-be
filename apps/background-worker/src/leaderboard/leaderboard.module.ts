import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { BackgroundLeaderboardService } from './background-leaderboard.service';
import { LeaderboardRepository } from './leaderboard.repository';
import { LeaderboardScoreProcessorService } from './leaderboard-score-processor.service';
import { ScoreChangeListenerService } from './score-change-listener.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    ScoreChangeListenerService,
    LeaderboardScoreProcessorService,
    LeaderboardRepository,
    BackgroundLeaderboardService,
  ],
})
export class LeaderboardWorkerModule {}
