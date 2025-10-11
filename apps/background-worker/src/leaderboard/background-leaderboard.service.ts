import { Injectable, Logger } from '@nestjs/common';
import { LeaderboardScope } from '@prisma/client';
import { LeaderboardRepository } from './leaderboard.repository';

interface DateRange {
  from?: Date;
  to?: Date;
}

interface ClassroomLeaderboardQuery {
  classroomId: string;
  year: number;
  month: number;
}

interface MonthlyLeaderboardQuery {
  year: number;
  month: number;
  classroomId?: string;
}

interface YearlyLeaderboardQuery {
  year: number;
  classroomId?: string;
}

interface LeaderboardEntry {
  userId: string;
  totalScore: number;
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  metadata?: {
    firstName: string | null;
    lastName: string | null;
  };
}

interface UserData {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

@Injectable()
export class BackgroundLeaderboardService {
  private readonly logger = new Logger(BackgroundLeaderboardService.name);

  constructor(private readonly repository: LeaderboardRepository) {}

  /**
   * Rebuild classroom leaderboard for specific period
   */
  async rebuildClassroomLeaderboard(
    query: ClassroomLeaderboardQuery,
  ): Promise<void> {
    const { classroomId, year, month } = query;
    const range = this.buildMonthRange(year, month);

    this.logger.debug(
      `Rebuilding classroom leaderboard: ${classroomId} for ${year}-${month}`,
    );

    const aggregated = await this.repository.aggregateClassroomScores({
      classroomId,
      from: range.from,
      to: range.to,
    });

    const entries = await this.buildEntries(aggregated);

    await this.repository.replaceSnapshots({
      scope: LeaderboardScope.classroom,
      classroomId,
      year,
      month,
      entries: entries.map((entry) => ({
        userId: entry.userId,
        totalScore: entry.totalScore,
        rank: entry.rank,
        payload: {
          displayName: entry.displayName,
          avatarUrl: entry.avatarUrl,
          metadata: entry.metadata ?? null,
          range: this.serializeRange(range),
        },
      })),
    });

    this.logger.debug(
      `Classroom leaderboard rebuilt: ${classroomId} (${entries.length} entries)`,
    );
  }

  /**
   * Rebuild monthly leaderboard for specific period
   */
  async rebuildMonthlyLeaderboard(
    query: MonthlyLeaderboardQuery,
  ): Promise<void> {
    const { year, month, classroomId } = query;
    const range = this.buildMonthRange(year, month);

    this.logger.debug(`Rebuilding monthly leaderboard for ${year}-${month}`);

    const aggregated = await this.repository.aggregateScoresByDateRange({
      from: range.from,
      to: range.to,
      classroomId,
    });

    const entries = await this.buildEntries(aggregated);

    await this.repository.replaceSnapshots({
      scope: LeaderboardScope.monthly,
      classroomId,
      year,
      month,
      entries: entries.map((entry) => ({
        userId: entry.userId,
        totalScore: entry.totalScore,
        rank: entry.rank,
        payload: {
          displayName: entry.displayName,
          avatarUrl: entry.avatarUrl,
          metadata: entry.metadata ?? null,
          range: this.serializeRange(range),
        },
      })),
    });

    this.logger.debug(
      `Monthly leaderboard rebuilt for ${year}-${month} (${entries.length} entries)`,
    );
  }

  /**
   * Rebuild yearly leaderboard for specific year
   */
  async rebuildYearlyLeaderboard(query: YearlyLeaderboardQuery): Promise<void> {
    const { year, classroomId } = query;
    const range = this.buildYearRange(year);

    this.logger.debug(`Rebuilding yearly leaderboard for ${year}`);

    const aggregated = await this.repository.aggregateScoresByDateRange({
      from: range.from,
      to: range.to,
      classroomId,
    });

    const entries = await this.buildEntries(aggregated);

    await this.repository.replaceSnapshots({
      scope: LeaderboardScope.yearly,
      classroomId,
      year,
      month: null,
      entries: entries.map((entry) => ({
        userId: entry.userId,
        totalScore: entry.totalScore,
        rank: entry.rank,
        payload: {
          displayName: entry.displayName,
          avatarUrl: entry.avatarUrl,
          metadata: entry.metadata ?? null,
          range: this.serializeRange(range),
        },
      })),
    });

    this.logger.debug(
      `Yearly leaderboard rebuilt for ${year} (${entries.length} entries)`,
    );
  }

  private async buildEntries(
    aggregated: { userId: string; totalScore: number }[],
  ): Promise<LeaderboardEntry[]> {
    if (!aggregated.length) {
      return [];
    }

    const sorted = [...aggregated].sort((a, b) => b.totalScore - a.totalScore);
    const userIds = sorted.map((item) => item.userId);
    const users = await this.repository.findUsersByIds(userIds);
    const userMap = new Map<string, UserData>(
      users.map((user) => [user.id, user as UserData]),
    );

    let currentRank = 0;
    let lastScore: number | null = null;
    let position = 0;

    return sorted.map((item) => {
      position += 1;
      if (lastScore === null || item.totalScore < lastScore) {
        currentRank = position;
        lastScore = item.totalScore;
      }

      const user = userMap.get(item.userId);
      const displayName = this.resolveDisplayName(user);

      return {
        userId: item.userId,
        totalScore: item.totalScore,
        rank: currentRank,
        displayName,
        avatarUrl: user?.avatarUrl ?? null,
        metadata: user
          ? {
              firstName: user.firstName,
              lastName: user.lastName,
            }
          : undefined,
      };
    });
  }

  private resolveDisplayName(user?: {
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
  }): string {
    if (!user) {
      return 'Unknown learner';
    }

    if (user.displayName && user.displayName.trim().length) {
      return user.displayName;
    }

    const parts = [user.lastName, user.firstName]
      .map((part) => part?.trim())
      .filter(Boolean);

    return parts.length ? parts.join(' ') : 'Unnamed learner';
  }

  private buildMonthRange(year: number, month: number): Required<DateRange> {
    const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    return { from, to };
  }

  private buildYearRange(year: number): Required<DateRange> {
    const from = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
    return { from, to };
  }

  private serializeRange(range: DateRange) {
    return {
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
    };
  }
}
