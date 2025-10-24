import { PayloadToken, ResponseMessage, Roles, RolesGuard } from '@app/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TeacherDashboardDto } from '../dto/dashboard.dto';
import { DashboardTeacherService } from '../service/dashboard-teacher.service';

@ApiTags('Dashboard')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/dashboard/teacher')
export class TeacherDashboardController {
    constructor(
        private readonly dashboardTeacherService: DashboardTeacherService,
    ) { }

    @Get()
    @UseGuards(RolesGuard)
    @Roles(UserRole.teacher)
    @ApiOperation({
        summary: 'Get teacher dashboard data (Teacher only)',
        description:
            'Lấy dữ liệu dashboard dành cho giáo viên: ' +
            'lớp học đang dạy, lịch dạy sắp tới, bài tập cần chấm, thông báo.',
    })
    @ApiResponse({
        status: 200,
        description: 'Teacher dashboard data retrieved successfully',
        type: TeacherDashboardDto,
    })
    @ResponseMessage('Teacher dashboard data fetched successfully')
    async getTeacherDashboard(
        @PayloadToken('sub') teacherUserId: string,
    ): Promise<TeacherDashboardDto> {
        return this.dashboardTeacherService.getTeacherDashboardData(teacherUserId);
    }
}

