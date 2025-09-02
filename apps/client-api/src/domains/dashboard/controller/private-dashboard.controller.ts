import { ResponseMessage } from '@app/shared';
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from '../service/dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard data' })
  @ResponseMessage('Dashboard data fetched successfully')
  getDashboardData() {
    return this.dashboardService.getDashboardData();
  }
}
