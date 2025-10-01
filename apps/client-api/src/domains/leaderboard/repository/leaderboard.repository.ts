import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { LeaderboardScope, Prisma } from '@prisma/client';

export interface AggregatedScore {
  userId: string;
  totalScore: number;
}

export interface SnapshotEntryInput {
  userId: string;
  totalScore: number;
  rank: number;
  payload?: Record<string, unknown> | null;
}

export interface SnapshotReplaceParams {
  scope: LeaderboardScope;
  classroomId?: string;
  year: number;
  month?: number | null;
  entries: SnapshotEntryInput[];
}

const SCORE_SOURCE_WEIGHTS = {
  assignments: 1,
  progress: 0.6,
  attempts: 0.4,
  podcast: 0.3,
} as const;

@Injectable()
export class LeaderboardRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async aggregateClassroomScores(params: {
    classroomId: string;
    from?: Date;
    to?: Date;
  }): Promise<AggregatedScore[]> {
    const assignments = await this.aggregateAssignmentScores(params);
    const progress = await this.aggregateProgressScores(params);
    const attempts = await this.aggregateActivityAttemptScores(params);
    const podcast = await this.aggregatePodcastAttemptScores(params);

    return this.mergeAggregatedScores([
      { scores: assignments, weight: SCORE_SOURCE_WEIGHTS.assignments },
      { scores: progress, weight: SCORE_SOURCE_WEIGHTS.progress },
      { scores: attempts, weight: SCORE_SOURCE_WEIGHTS.attempts },
      { scores: podcast, weight: SCORE_SOURCE_WEIGHTS.podcast },
    ]);
  }

  async aggregateScoresByDateRange(params: {
    from: Date;
    to: Date;
    classroomId?: string;
  }): Promise<AggregatedScore[]> {
    const assignments = await this.aggregateAssignmentScores(params);
    const progress = await this.aggregateProgressScores(params);
    const attempts = await this.aggregateActivityAttemptScores(params);
    const podcast = await this.aggregatePodcastAttemptScores(params);

    return this.mergeAggregatedScores([
      { scores: assignments, weight: SCORE_SOURCE_WEIGHTS.assignments },
      { scores: progress, weight: SCORE_SOURCE_WEIGHTS.progress },
      { scores: attempts, weight: SCORE_SOURCE_WEIGHTS.attempts },
      { scores: podcast, weight: SCORE_SOURCE_WEIGHTS.podcast },
    ]);
  }

  async findUsersByIds(userIds: string[]) {
    if (!userIds.length) {
      return [];
    }

    return this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });
  }

  async replaceSnapshots(params: SnapshotReplaceParams): Promise<void> {
    const { scope, classroomId, year, month, entries } = params;
    const normalizedMonth = typeof month === 'number' ? month : null;

    await this.prisma.$transaction([
      this.prisma.leaderboardSnapshot.deleteMany({
        where: {
          scope,
          classroomId: classroomId ?? null,
          year,
          month: normalizedMonth,
        },
      }),
      ...(entries.length
        ? [
            this.prisma.leaderboardSnapshot.createMany({
              data: entries.map((entry) => ({
                scope,
                classroomId: classroomId ?? null,
                year,
                month: normalizedMonth,
                userId: entry.userId,
                totalScore: entry.totalScore,
                rank: entry.rank,
                payload:
                  entry.payload !== undefined && entry.payload !== null
                    ? (entry.payload as Prisma.JsonValue)
                    : Prisma.JsonNull,
              })),
            }),
          ]
        : []),
    ]);
  }

  private async aggregateAssignmentScores(params: {
    classroomId?: string;
    from?: Date;
    to?: Date;
  }): Promise<AggregatedScore[]> {
    const { classroomId, from, to } = params;

    const where: Prisma.AssignmentSubmissionWhereInput = {
      score: { not: null },
      ...(from || to
        ? {
            submittedAt: {
              gte: from,
              lt: to,
            },
          }
        : {}),
      ...(classroomId ? { assignment: { classroomId } } : {}),
    };

    const grouped = await this.prisma.assignmentSubmission.groupBy({
      by: ['studentId'],
      where,
      _sum: { score: true },
    });

    return grouped
      .map((item) => ({
        userId: item.studentId,
        totalScore: item._sum.score ?? 0,
      }))
      .filter((item) => item.totalScore > 0);
  }

  private async aggregateProgressScores(params: {
    classroomId?: string;
    from?: Date;
    to?: Date;
  }): Promise<AggregatedScore[]> {
    const { classroomId, from, to } = params;

    const userColumn = classroomId
      ? Prisma.sql`cs."studentId"`
      : Prisma.sql`p."userId"`;

    const classroomJoins = classroomId
      ? Prisma.sql`
          JOIN "Classroom" c ON c."courseId" = co."id"
          JOIN "ClassroomStudent" cs
            ON cs."classroomId" = c."id"
           AND cs."studentId" = p."userId"
           AND cs."isActive" = true
        `
      : Prisma.sql``;

    const conditions: Prisma.Sql[] = [];
    if (classroomId) {
      conditions.push(Prisma.sql`c."id" = ${classroomId}`);
    }
    if (from) {
      conditions.push(Prisma.sql`p."updatedAt" >= ${from}`);
    }
    if (to) {
      conditions.push(Prisma.sql`p."updatedAt" < ${to}`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<AggregatedScore[]>(
      Prisma.sql`
        SELECT ${userColumn} AS "userId",
               SUM(COALESCE(p."bestScore", p."score", 0))::float AS "totalScore"
        FROM "Progress" p
        JOIN "Activity" a ON a."id" = p."activityId"
        JOIN "Lesson" l ON l."id" = a."lessonId"
        JOIN "Course" co ON co."id" = l."courseId"
        ${classroomJoins}
        ${whereClause}
        GROUP BY ${userColumn}
      `,
    );

    return rows.filter((row) => (row?.totalScore ?? 0) > 0);
  }

  private async aggregateActivityAttemptScores(params: {
    classroomId?: string;
    from?: Date;
    to?: Date;
  }): Promise<AggregatedScore[]> {
    const { classroomId, from, to } = params;

    const userColumn = classroomId
      ? Prisma.sql`cs."studentId"`
      : Prisma.sql`at."userId"`;

    const classroomJoins = classroomId
      ? Prisma.sql`
          JOIN "Classroom" c ON c."courseId" = co."id"
          JOIN "ClassroomStudent" cs
            ON cs."classroomId" = c."id"
           AND cs."studentId" = at."userId"
           AND cs."isActive" = true
        `
      : Prisma.sql``;

    const conditions: Prisma.Sql[] = [];
    if (classroomId) {
      conditions.push(Prisma.sql`c."id" = ${classroomId}`);
    }
    if (from) {
      conditions.push(Prisma.sql`at."createdAt" >= ${from}`);
    }
    if (to) {
      conditions.push(Prisma.sql`at."createdAt" < ${to}`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<AggregatedScore[]>(
      Prisma.sql`
        SELECT ${userColumn} AS "userId",
               SUM(COALESCE(at."score", 0))::float AS "totalScore"
        FROM "Attempt" at
        JOIN "Activity" a ON a."id" = at."activityId"
        JOIN "Lesson" l ON l."id" = a."lessonId"
        JOIN "Course" co ON co."id" = l."courseId"
        ${classroomJoins}
        ${whereClause}
        GROUP BY ${userColumn}
      `,
    );

    return rows.filter((row) => (row?.totalScore ?? 0) > 0);
  }

  private async aggregatePodcastAttemptScores(params: {
    classroomId?: string;
    from?: Date;
    to?: Date;
  }): Promise<AggregatedScore[]> {
    const { classroomId, from, to } = params;

    const userColumn = classroomId
      ? Prisma.sql`cs."studentId"`
      : Prisma.sql`pa."userId"`;

    const classroomJoins = classroomId
      ? Prisma.sql`
          JOIN "ClassroomStudent" cs
            ON cs."studentId" = pa."userId"
           AND cs."isActive" = true
           AND cs."classroomId" = ${classroomId}
        `
      : Prisma.sql``;

    const conditions: Prisma.Sql[] = [];
    if (from) {
      conditions.push(Prisma.sql`pa."createdAt" >= ${from}`);
    }
    if (to) {
      conditions.push(Prisma.sql`pa."createdAt" < ${to}`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<AggregatedScore[]>(
      Prisma.sql`
        SELECT ${userColumn} AS "userId",
               SUM(COALESCE(pa."scorePercent", 0))::float AS "totalScore"
        FROM "podcast_attempts" pa
        ${classroomJoins}
        ${whereClause}
        GROUP BY ${userColumn}
      `,
    );

    return rows.filter((row) => (row?.totalScore ?? 0) > 0);
  }

  private mergeAggregatedScores(
    sources: { scores: AggregatedScore[]; weight: number }[],
  ): AggregatedScore[] {
    const totals = new Map<string, number>();

    for (const { scores, weight } of sources) {
      if (!scores.length || weight <= 0) {
        continue;
      }

      for (const entry of scores) {
        const current = totals.get(entry.userId) ?? 0;
        const contribution = (entry.totalScore ?? 0) * weight;
        totals.set(entry.userId, current + contribution);
      }
    }

    return Array.from(totals.entries())
      .map(([userId, total]) => ({
        userId,
        totalScore: Math.round(total),
      }))
      .filter((item) => item.totalScore > 0);
  }
}
