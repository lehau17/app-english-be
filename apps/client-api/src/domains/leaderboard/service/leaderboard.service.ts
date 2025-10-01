import { Injectable, BadRequestException } from '@nestjs/common';
import { LeaderboardScope } from '@prisma/client';
import {
  ClassroomLeaderboardQueryDto,
  LeaderboardEntryDto,
  LeaderboardResponseDto,
  MonthlyLeaderboardQueryDto,
  YearlyLeaderboardQueryDto,
} from '../dto/leaderboard.dto';
import { LeaderboardRepository } from '../repository/leaderboard.repository';

interface DateRange {
  from?: Date;
  to?: Date;
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly repository: LeaderboardRepository) {}

  async getClassroomLeaderboard(
    classroomId: string,
    query: ClassroomLeaderboardQueryDto,
  ): Promise<LeaderboardResponseDto> {
    const rangeResolution = this.resolveClassroomRange(query);
    const aggregated = await this.repository.aggregateClassroomScores({
      classroomId,
      from: rangeResolution.range.from,
      to: rangeResolution.range.to,
    });

    const entries = await this.buildEntries(aggregated);

    await this.repository.replaceSnapshots({
      scope: LeaderboardScope.classroom,
      classroomId,
      year: rangeResolution.snapshotYear,
      month: rangeResolution.snapshotMonth,
      entries: entries.map((entry) => ({
        userId: entry.userId,
        totalScore: entry.totalScore,
        rank: entry.rank,
        payload: {
          displayName: entry.displayName,
          avatarUrl: entry.avatarUrl,
          metadata: entry.metadata ?? null,
          range: this.serializeRange(rangeResolution.range),
        },
      })),
    });

    return {
      scope: LeaderboardScope.classroom,
      classroomId,
      year: rangeResolution.snapshotYear,
      month: rangeResolution.snapshotMonth,
      from: rangeResolution.range.from?.toISOString(),
      to: rangeResolution.range.to?.toISOString(),
      entries,
    };
  }

  async getMonthlyLeaderboard(
    query: MonthlyLeaderboardQueryDto,
  ): Promise<LeaderboardResponseDto> {
    const { year, month, classroomId } = query;
    const range = this.buildMonthRange(year, month);

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

    return {
      scope: LeaderboardScope.monthly,
      classroomId,
      year,
      month,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      entries,
    };
  }

  async getYearlyLeaderboard(
    query: YearlyLeaderboardQueryDto,
  ): Promise<LeaderboardResponseDto> {
    const { year, classroomId } = query;
    const range = this.buildYearRange(year);

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

    return {
      scope: LeaderboardScope.yearly,
      classroomId,
      year,
      month: null,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      entries,
    };
  }

  private async buildEntries(
    aggregated: { userId: string; totalScore: number }[],
  ): Promise<LeaderboardEntryDto[]> {
    if (!aggregated.length) {
      return [];
    }

    const sorted = [...aggregated].sort((a, b) => b.totalScore - a.totalScore);
    const userIds = sorted.map((item) => item.userId);
    const users = await this.repository.findUsersByIds(userIds);
    const userMap = new Map(users.map((user) => [user.id, user]));

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
      } satisfies LeaderboardEntryDto;
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

  private resolveClassroomRange(query: ClassroomLeaderboardQueryDto): {
    range: DateRange;
    snapshotYear: number;
    snapshotMonth: number | null;
  } {
    const now = new Date();

    if ((query.from && !query.to) || (!query.from && query.to)) {
      throw new BadRequestException(
        'Both "from" and "to" must be provided together, or neither.',
      );
    }

    if (query.from && query.to) {
      const from = this.parseDate(query.from, 'from');
      const to = this.parseDate(query.to, 'to');

      if (from >= to) {
        throw new BadRequestException('"from" must be earlier than "to".');
      }

      return {
        range: { from, to },
        snapshotYear: from.getUTCFullYear(),
        snapshotMonth: from.getUTCMonth() + 1,
      };
    }

    if (query.year && query.month) {
      const range = this.buildMonthRange(query.year, query.month);
      return {
        range,
        snapshotYear: query.year,
        snapshotMonth: query.month,
      };
    }

    if (query.year && !query.month) {
      const range = this.buildYearRange(query.year);
      return {
        range,
        snapshotYear: query.year,
        snapshotMonth: null,
      };
    }

    const currentRange = this.buildMonthRange(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
    );

    return {
      range: currentRange,
      snapshotYear: now.getUTCFullYear(),
      snapshotMonth: now.getUTCMonth() + 1,
    };
  }

  private buildMonthRange(year: number, month: number): Required<DateRange> {
    if (month < 1 || month > 12) {
      throw new BadRequestException('"month" must be between 1 and 12.');
    }

    const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    return { from, to };
  }

  private buildYearRange(year: number): Required<DateRange> {
    const from = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
    return { from, to };
  }

  private parseDate(value: string, label: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date value for "${label}".`);
    }
    return parsed;
  }

  private serializeRange(range: DateRange) {
    return {
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
    };
  }
}
