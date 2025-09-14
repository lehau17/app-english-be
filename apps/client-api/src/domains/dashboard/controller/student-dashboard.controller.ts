import { JwtPayload, PayloadToken } from '@app/shared';
import {
  Controller,
  Get
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardStudentService } from '../service/dashboard-student.service';

@ApiTags('Student Dashboard')
  @ApiBearerAuth('Authorization')
@Controller('/private/v1/student-dashboard')
export class StudentDashboardController {
  constructor(private readonly dashboardStudentService: DashboardStudentService) {}

  @Get()
  @ApiOperation({ summary: 'Get student dashboard data (quests, leaderboard, streak, ...)' })
  async getStudentDashboard(@PayloadToken() payload : JwtPayload) {
    const userId = payload.sub
    return this.dashboardStudentService.getStudentDashboard(userId);
  }
}
