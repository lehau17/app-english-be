import { Module } from '@nestjs/common';
import { DashboardController } from './controller/private-dashboard.controller';
import { DashboardService } from './service/dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
