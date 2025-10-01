import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaderboardService } from './leaderboard.service';

@Injectable()
export class LeaderboardCronService {
  private readonly logger = new Logger(LeaderboardCronService.name);

  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async rebuildSnapshotsForCurrentPeriod() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    try {
      await this.leaderboardService.getMonthlyLeaderboard({ year, month });
      await this.leaderboardService.getYearlyLeaderboard({ year });
      this.logger.debug(
        `Leaderboard snapshots refreshed for ${year}-${String(month).padStart(2, '0')}.`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to refresh leaderboard snapshots',
        error as Error,
      );
    }
  }
}
