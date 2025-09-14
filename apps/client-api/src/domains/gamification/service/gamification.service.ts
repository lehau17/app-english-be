import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@app/database';

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaRepository) {}

  async addXp(userId: string, amount: number) {
    const stats = await this.prisma.userStats.upsert({
      where: { userId },
      update: { xp: { increment: amount } },
      create: { userId, xp: amount },
    });
    await this.checkLevelUp(userId, stats.xp + amount);
    return stats;
  }

  async addCoins(userId: string, amount: number) {
    return this.prisma.userStats.update({
      where: { userId },
      data: { coins: { increment: amount } },
    });
  }

  async updateStreak(userId: string) {
    const stats = await this.prisma.userStats.findUnique({ where: { userId } });
    const today = new Date().toDateString();
    if (!stats?.lastStreakAt || new Date(stats.lastStreakAt).toDateString() !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = stats?.lastStreakAt && new Date(stats.lastStreakAt).toDateString() === yesterday.toDateString();
      await this.prisma.userStats.update({
        where: { userId },
        data: {
          streakDays: isYesterday ? { increment: 1 } : 1,
          lastStreakAt: new Date(),
        },
      });
    }
  }

  async checkLevelUp(userId: string, xp: number) {
    let level = 1;
    let xpForNext = 100;
    while (xp >= xpForNext) {
      level++;
      xpForNext += 100 * level;
    }
    await this.prisma.userStats.update({
      where: { userId },
      data: { level },
    });
  }

  async getLeaderboard(periodType: string, periodStart: Date, periodEnd: Date) {
    return this.prisma.leaderboardEntry.findMany({
      where: { periodType, periodStart, periodEnd },
      orderBy: { xp: 'desc' },
      take: 10,
      include: { user: true },
    });
  }

  async getDailyQuests(userId: string) {
    const quests = await this.prisma.dailyQuest.findMany();
    const progress = await this.prisma.questProgress.findMany({ where: { userId } });
    return quests.map(q => ({
      ...q,
      done: !!progress.find(p => p.questId === q.id && p.done),
    }));
  }

  async completeQuest(userId: string, questId: string) {
    await this.prisma.questProgress.upsert({
      where: { userId_questId: { userId, questId } },
      update: { done: true },
      create: { userId, questId, done: true },
    });
    const quest = await this.prisma.dailyQuest.findUnique({ where: { id: questId } });
    if (quest) {
      await this.addXp(userId, quest.xpReward ?? 10);
    }
    return { success: true };
  }
}
