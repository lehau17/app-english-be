import { ResponseMessage } from '@app/shared';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateSessionScheduleDto,
  UpdateSessionScheduleDto,
} from '../dto/session-schedule.dto';
import { SessionScheduleService } from '../service/session-schedule.service';

@ApiTags('Course Session Schedules')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/courses/:courseId/session-schedules')
export class SessionScheduleController {
  constructor(
    private readonly sessionScheduleService: SessionScheduleService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy lịch trình các buổi học của một khóa học' })
  @ResponseMessage('Lịch trình buổi học được lấy thành công')
  async getSessionSchedules(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ) {
    return this.sessionScheduleService.findByCourseId(courseId);
  }

  @Put()
  @ApiOperation({
    summary: 'Cập nhật toàn bộ lịch trình các buổi học của một khóa học',
  })
  @ResponseMessage('Lịch trình buổi học được cập nhật thành công')
  async updateSessionSchedules(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() schedules: CreateSessionScheduleDto[],
  ) {
    return this.sessionScheduleService.createSessionSchedules(
      courseId,
      schedules,
    );
  }

  @Put(':sessionNumber')
  @ApiOperation({ summary: 'Cập nhật lịch trình một buổi học cụ thể' })
  @ResponseMessage('Lịch trình buổi học được cập nhật thành công')
  async updateSessionSchedule(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Param('sessionNumber', new ParseIntPipe()) sessionNumber: number,
    @Body() dto: UpdateSessionScheduleDto,
  ) {
    return this.sessionScheduleService.updateSessionSchedule(
      courseId,
      sessionNumber,
      dto,
    );
  }
}
