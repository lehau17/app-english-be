import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { LeaderboardRepository } from '../../../client-api/src/domains/leaderboard/repository/leaderboard.repository';
import { LeaderboardService } from '../../../client-api/src/domains/leaderboard/service/leaderboard.service';
import { LeaderboardScoreProcessorService } from './leaderboard-score-processor.service';
import { ScoreChangeListenerService } from './score-change-listener.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    ScoreChangeListenerService,
    LeaderboardScoreProcessorService,
    LeaderboardRepository,
    LeaderboardService,
  ],
})
export class LeaderboardWorkerModule {}
