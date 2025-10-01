import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaderboardService } from '../../../client-api/src/domains/leaderboard/service/leaderboard.service';
import { ScoreChangeListenerService } from './score-change-listener.service';

type ScoreChangeEvent = {
  table: string;
  id: string;
  operation: string;
  occurredAt?: string;
};

interface ClassroomPeriod {
  classroomId: string;
  year: number;
  month: number;
}

interface PeriodKey {
  year: number;
  month: number;
}

@Injectable()
export class LeaderboardScoreProcessorService {
  private readonly logger = new Logger(LeaderboardScoreProcessorService.name);

  constructor(
    private readonly listener: ScoreChangeListenerService,
    private readonly prisma: PrismaRepository,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleScheduledRebuild() {
    const events = this.listener.drainEvents();
    const now = new Date();
    const currentPeriod: PeriodKey = {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    };

    try {
      const {
        classroomPeriods,
        monthlyPeriods,
        yearlyPeriods,
      } = await this.resolveAffectedPeriods(events, currentPeriod);

      await this.rebuildClassroomLeaderboards(classroomPeriods);
      await this.rebuildMonthlyLeaderboards(monthlyPeriods);
      await this.rebuildYearlyLeaderboards(yearlyPeriods);
    } catch (error) {
      this.logger.error('Failed to process leaderboard rebuild', error as Error);
    }
  }

  private async resolveAffectedPeriods(
    events: ScoreChangeEvent[],
    current: PeriodKey,
  ): Promise<{
    classroomPeriods: ClassroomPeriod[];
    monthlyPeriods: PeriodKey[];
    yearlyPeriods: number[];
  }> {
    const classroomKeySet = new Set<string>();
    const monthKeySet = new Set<string>();
    const yearSet = new Set<number>();

    const addMonth = (year: number, month: number) => {
      const key = `${year}-${month}`;
      monthKeySet.add(key);
      yearSet.add(year);
    };

    // Always include current period rebuilds
    addMonth(current.year, current.month);

    for (const event of events) {
      const occurred = this.extractEventDate(event) ?? new Date();
      const eventYear = occurred.getUTCFullYear();
      const eventMonth = occurred.getUTCMonth() + 1;

      addMonth(eventYear, eventMonth);

      switch (event.table) {
        case 'AssignmentSubmission':
          await this.collectAssignmentContext(
            event.id,
            occurred,
            classroomKeySet,
            addMonth,
          );
          break;
        case 'Progress':
          await this.collectProgressContext(
            event.id,
            occurred,
            classroomKeySet,
            addMonth,
          );
          break;
        case 'Attempt':
          await this.collectActivityAttemptContext(
            event.id,
            occurred,
            classroomKeySet,
            addMonth,
          );
          break;
        case 'podcast_attempts':
          await this.collectPodcastContext(
            event.id,
            occurred,
            classroomKeySet,
            addMonth,
          );
          break;
        default:
          // Other tables do not yet resolve to a specific classroom; only global periods are considered
          break;
      }
    }

    const classroomPeriods: ClassroomPeriod[] = Array.from(classroomKeySet).map(
      (key) => {
        const [classroomId, year, month] = key.split(':');
        return {
          classroomId,
          year: Number(year),
          month: Number(month),
        };
      },
    );

    const monthlyPeriods: PeriodKey[] = Array.from(monthKeySet).map((key) => {
      const [year, month] = key.split('-');
      return { year: Number(year), month: Number(month) };
    });

    const yearlyPeriods = Array.from(yearSet.values());

    return { classroomPeriods, monthlyPeriods, yearlyPeriods };
  }

  private async collectAssignmentContext(
    submissionId: string,
    fallbackDate: Date,
    classroomKeySet: Set<string>,
    addMonth: (year: number, month: number) => void,
  ) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        submittedAt: true,
        assignment: {
          select: {
            classroomId: true,
          },
        },
      },
    });

    if (!submission?.assignment?.classroomId) {
      return;
    }

    const effectiveDate = submission.submittedAt ?? fallbackDate;
    const year = effectiveDate.getUTCFullYear();
    const month = effectiveDate.getUTCMonth() + 1;

    classroomKeySet.add(
      `${submission.assignment.classroomId}:${year}:${month}`,
    );
    addMonth(year, month);
  }

  private async collectProgressContext(
    progressId: string,
    fallbackDate: Date,
    classroomKeySet: Set<string>,
    addMonth: (year: number, month: number) => void,
  ) {
    const progress = await this.prisma.progress.findUnique({
      where: { id: progressId },
      select: {
        updatedAt: true,
        userId: true,
        activity: {
          select: {
            lesson: {
              select: {
                courseId: true,
              },
            },
          },
        },
      },
    });

    if (!progress?.userId || !progress.activity?.lesson?.courseId) {
      addMonth(fallbackDate.getUTCFullYear(), fallbackDate.getUTCMonth() + 1);
      return;
    }

    const memberships = await this.prisma.classroomStudent.findMany({
      where: {
        studentId: progress.userId,
        isActive: true,
        classroom: {
          courseId: progress.activity.lesson.courseId,
        },
      },
      select: { classroomId: true },
    });

    const effectiveDate = progress.updatedAt ?? fallbackDate;
    const year = effectiveDate.getUTCFullYear();
    const month = effectiveDate.getUTCMonth() + 1;

    for (const membership of memberships) {
      classroomKeySet.add(`${membership.classroomId}:${year}:${month}`);
    }

    addMonth(year, month);
  }

  private async collectActivityAttemptContext(
    attemptId: string,
    fallbackDate: Date,
    classroomKeySet: Set<string>,
    addMonth: (year: number, month: number) => void,
  ) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      select: {
        createdAt: true,
        userId: true,
        activity: {
          select: {
            lesson: {
              select: {
                courseId: true,
              },
            },
          },
        },
      },
    });

    if (!attempt?.userId || !attempt.activity?.lesson?.courseId) {
      addMonth(fallbackDate.getUTCFullYear(), fallbackDate.getUTCMonth() + 1);
      return;
    }

    const memberships = await this.prisma.classroomStudent.findMany({
      where: {
        studentId: attempt.userId,
        isActive: true,
        classroom: {
          courseId: attempt.activity.lesson.courseId,
        },
      },
      select: { classroomId: true },
    });

    const effectiveDate = attempt.createdAt ?? fallbackDate;
    const year = effectiveDate.getUTCFullYear();
    const month = effectiveDate.getUTCMonth() + 1;

    for (const membership of memberships) {
      classroomKeySet.add(`${membership.classroomId}:${year}:${month}`);
    }

    addMonth(year, month);
  }

  private async collectPodcastContext(
    podcastAttemptId: string,
    fallbackDate: Date,
    classroomKeySet: Set<string>,
    addMonth: (year: number, month: number) => void,
  ) {
    const podcastAttempt = await this.prisma.podcastAttempt.findUnique({
      where: { id: podcastAttemptId },
      select: {
        createdAt: true,
        userId: true,
      },
    });

    if (!podcastAttempt?.userId) {
      addMonth(fallbackDate.getUTCFullYear(), fallbackDate.getUTCMonth() + 1);
      return;
    }

    const memberships = await this.prisma.classroomStudent.findMany({
      where: {
        studentId: podcastAttempt.userId,
        isActive: true,
      },
      select: { classroomId: true },
    });

    const effectiveDate = podcastAttempt.createdAt ?? fallbackDate;
    const year = effectiveDate.getUTCFullYear();
    const month = effectiveDate.getUTCMonth() + 1;

    for (const membership of memberships) {
      classroomKeySet.add(`${membership.classroomId}:${year}:${month}`);
    }

    addMonth(year, month);
  }

  private extractEventDate(event: ScoreChangeEvent): Date | undefined {
    if (!event.occurredAt) {
      return undefined;
    }
    const parsed = new Date(event.occurredAt);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private async rebuildClassroomLeaderboards(classroomPeriods: ClassroomPeriod[]) {
    for (const context of classroomPeriods) {
      try {
        await this.leaderboardService.getClassroomLeaderboard(context.classroomId, {
          year: context.year,
          month: context.month,
        });
      } catch (error) {
        this.logger.error(
          `Failed to rebuild classroom leaderboard for classroom=${context.classroomId} period=${context.year}-${context.month}`,
          error as Error,
        );
      }
    }
  }

  private async rebuildMonthlyLeaderboards(periods: PeriodKey[]) {
    for (const period of periods) {
      try {
        await this.leaderboardService.getMonthlyLeaderboard({
          year: period.year,
          month: period.month,
        });
      } catch (error) {
        this.logger.error(
          `Failed to rebuild monthly leaderboard for ${period.year}-${period.month}`,
          error as Error,
        );
      }
    }
  }

  private async rebuildYearlyLeaderboards(years: number[]) {
    for (const year of years) {
      try {
        await this.leaderboardService.getYearlyLeaderboard({ year });
      } catch (error) {
        this.logger.error(
          `Failed to rebuild yearly leaderboard for ${year}`,
          error as Error,
        );
      }
    }
  }
}
