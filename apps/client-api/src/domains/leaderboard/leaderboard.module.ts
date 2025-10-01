import { SharedModule } from '@app/shared';
import { Module } from '@nestjs/common';
import { PrivateLeaderboardController } from './controller/private-leaderboard.controller';
import { LeaderboardRepository } from './repository/leaderboard.repository';
import { LeaderboardCronService } from './service/leaderboard.cron.service';
import { LeaderboardService } from './service/leaderboard.service';

@Module({
  imports: [SharedModule],
  controllers: [PrivateLeaderboardController],
  providers: [
    LeaderboardService,
    LeaderboardRepository,
    LeaderboardCronService,
  ],
})
export class LeaderboardModule {}
