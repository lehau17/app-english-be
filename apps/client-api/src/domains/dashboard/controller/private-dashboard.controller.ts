import { ResponseMessage, Roles, RolesGuard } from '@app/shared';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AnalyticsPeriod } from '../dto/analytics.dto';
import { DashboardService } from '../service/dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@ApiTags('Dashboard - Private')
@Controller('/private/v1/dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard data' })
  @ResponseMessage('Dashboard data fetched successfully')
  getDashboardData() {
    return this.dashboardService.getDashboardData();
  }

  @Get('analytics/student/:studentId')
  @Roles(UserRole.admin, UserRole.teacher)
  @ApiOperation({
    summary: 'Get AI-powered analytics for a specific student',
    description: 'Analyze student learning patterns using Gemini AI',
  })
  @ApiParam({ name: 'studentId', type: String, description: 'Student UUID' })
  @ApiQuery({
    name: 'period',
    enum: AnalyticsPeriod,
    required: false,
    description: 'Analysis period',
  })
  @ResponseMessage('Student analytics retrieved successfully')
  getStudentAnalytics(
    @Param('studentId') studentId: string,
    @Query('period') period?: AnalyticsPeriod,
  ) {
    return this.dashboardService.getStudentAIAnalytics(studentId, period);
  }

  @Get('analytics/classroom/:classroomId')
  @Roles(UserRole.admin, UserRole.teacher)
  @ApiOperation({
    summary: 'Get AI-powered analytics for a classroom',
    description: 'Analyze classroom learning patterns using Gemini AI',
  })
  @ApiParam({
    name: 'classroomId',
    type: String,
    description: 'Classroom UUID',
  })
  @ApiQuery({
    name: 'period',
    enum: AnalyticsPeriod,
    required: false,
    description: 'Analysis period',
  })
  @ResponseMessage('Classroom analytics retrieved successfully')
  getClassroomAnalytics(
    @Param('classroomId') classroomId: string,
    @Query('period') period?: AnalyticsPeriod,
  ) {
    return this.dashboardService.getClassAIAnalytics(classroomId, period);
  }
}
