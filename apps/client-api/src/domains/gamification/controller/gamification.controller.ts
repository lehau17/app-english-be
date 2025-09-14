import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { GamificationService } from '../service/gamification.service';

@Controller('/private/v1/gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('leaderboard')
  async getLeaderboard(
    @Query('periodType') periodType: string = 'week',
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const leaderboard = await this.gamificationService.getLeaderboard(periodType, start, end);
    return leaderboard.map(e => ({
      id: e.userId,
      name: e.user?.name || 'Học sinh',
      xp: e.xp,
      rank: e.rank,
    }));
  }

  @Get('daily-quests')
  async getDailyQuests(@Req() req) {
    const userId = req.user.id;
    return this.gamificationService.getDailyQuests(userId);
  }

  @Post('complete-quest')
  async completeQuest(@Req() req, @Body() body: { questId: string }) {
    const userId = req.user.id;
    return this.gamificationService.completeQuest(userId, body.questId);
  }

  @Post('add-xp')
  async addXp(@Req() req, @Body() body: { amount: number }) {
    const userId = req.user.id;
    return this.gamificationService.addXp(userId, body.amount);
  }

  @Post('add-coins')
  async addCoins(@Req() req, @Body() body: { amount: number }) {
    const userId = req.user.id;
    return this.gamificationService.addCoins(userId, body.amount);
  }

  @Post('update-streak')
  async updateStreak(@Req() req) {
    const userId = req.user.id;
    return this.gamificationService.updateStreak(userId);
  }
}
