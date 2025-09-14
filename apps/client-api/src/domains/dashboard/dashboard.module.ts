import { Module } from '@nestjs/common';
import { StudentDashboardController } from './controller';
import { DashboardController } from './controller/private-dashboard.controller';
import { DashboardService } from './service/dashboard.service';
import { DashboardStudentService } from './service/dashboard-student.service';

@Module({
  controllers: [DashboardController, StudentDashboardController],
  providers: [DashboardService, DashboardStudentService],
})
export class DashboardModule {}
