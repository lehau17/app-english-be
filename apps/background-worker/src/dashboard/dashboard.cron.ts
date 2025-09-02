import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DashboardService } from './dashboard.service';

@Injectable()
export class DashboardCron {
  constructor(private readonly dashboardService: DashboardService) {}

  @Cron('0 0 * * *')
  async handleCron() {
    await this.dashboardService.calculateDashboardData();
  }
}
