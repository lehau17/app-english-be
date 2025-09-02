import { Module } from '@nestjs/common';
import { DashboardCron } from './dashboard.cron';
import { DashboardService } from './dashboard.service';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [DatabaseModule],
  providers: [DashboardService, DashboardCron],
})
export class DashboardModule {}
