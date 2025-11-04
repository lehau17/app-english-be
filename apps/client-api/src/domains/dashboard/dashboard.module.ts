import { Module } from '@nestjs/common';
import { StudentDashboardController } from './controller';
import { DashboardController } from './controller/private-dashboard.controller';
import { TeacherDashboardController } from './controller/teacher-dashboard.controller';
import { DashboardStudentService } from './service/dashboard-student.service';
import { DashboardTeacherService } from './service/dashboard-teacher.service';
import { DashboardService } from './service/dashboard.service';

@Module({
  controllers: [
    DashboardController,
    StudentDashboardController,
    TeacherDashboardController,
  ],
  providers: [
    DashboardService,
    DashboardStudentService,
    DashboardTeacherService,
  ],
})
export class DashboardModule {}
