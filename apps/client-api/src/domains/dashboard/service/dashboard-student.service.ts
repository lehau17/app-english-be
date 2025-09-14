import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DashboardStudentService {
  constructor(private readonly prisma: PrismaRepository) {}

  async getStudentDashboard(userId: string) {
    // Lấy UserStats
    const stats = await this.prisma.userStats.findUnique({ where: { userId } });

    // Lấy daily quests và trạng thái hoàn thành
    const quests = await this.prisma.dailyQuest.findMany();
    const questProgress = await this.prisma.questProgress.findMany({ where: { userId } });
    const dailyQuests = quests.map(q => ({
      id: q.id,
      text: q.text,
      done: !!questProgress.find(p => p.questId === q.id && p.done),
    }));

    // Lấy leaderboard tuần hiện tại
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const leaderboardEntries = await this.prisma.leaderboardEntry.findMany({
      where: {
        periodType: 'week',
        periodStart: weekStart,
        periodEnd: weekEnd,
      },
      orderBy: { xp: 'desc' },
      take: 10,
      include: { user: true },
    });
    const leaderboard = leaderboardEntries.map(e => ({
      id: e.userId,
      name: e.user?.displayName || 'Học sinh',
      xp: e.xp,
    }));

    return {
      xp: stats?.xp ?? 0,
      level: stats?.level ?? 1,
      coins: stats?.coins ?? 0,
      streak: stats?.streakDays ?? 0,
      dailyQuests,
      leaderboard,
    };
  }
}
