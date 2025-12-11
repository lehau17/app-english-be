import { ResponseMessage } from '@app/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AttendanceStatusDto,
  AttendanceWithStudentDto,
  BulkAttendanceDto,
  ClassroomAttendanceStatsDto,
  MarkAllAbsentResponseDto,
  MarkAttendanceDto,
  PaginatedStudentAttendanceHistoryDto,
  SessionAttendanceSummaryDto,
  StudentAttendanceHistoryQueryDto,
  UnmarkedStudentDto,
} from '../dto/attendance.dto';
import { AttendanceService } from '../services/attendance.service';

@ApiTags('Attendance - Điểm danh')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/sessions')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ==================== SESSION ATTENDANCE ====================

  @Get(':sessionId/attendance')
  @ApiOperation({
    summary: 'Lấy danh sách điểm danh của một buổi học',
    description:
      'Trả về danh sách học sinh đã được điểm danh với thông tin chi tiết',
  })
  @ApiParam({ name: 'sessionId', description: 'ID của buổi học' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách điểm danh',
    type: [AttendanceWithStudentDto],
  })
  @ResponseMessage('Lấy danh sách điểm danh thành công')
  async getSessionAttendances(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.attendanceService.getSessionAttendances(sessionId);
  }

  @Get(':sessionId/attendance/summary')
  @ApiOperation({
    summary: 'Lấy tổng hợp điểm danh của một buổi học',
    description:
      'Trả về thống kê tổng hợp: có mặt, vắng, muộn, có phép và tỷ lệ',
  })
  @ApiParam({ name: 'sessionId', description: 'ID của buổi học' })
  @ApiResponse({
    status: 200,
    description: 'Tổng hợp điểm danh',
    type: SessionAttendanceSummaryDto,
  })
  @ResponseMessage('Lấy tổng hợp điểm danh thành công')
  async getSessionSummary(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.attendanceService.getSessionSummary(sessionId);
  }

  @Get(':sessionId/attendance/unmarked')
  @ApiOperation({
    summary: 'Lấy danh sách học sinh chưa điểm danh',
    description:
      'Trả về danh sách học sinh trong lớp nhưng chưa được điểm danh',
  })
  @ApiParam({ name: 'sessionId', description: 'ID của buổi học' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách học sinh chưa điểm danh',
    type: [UnmarkedStudentDto],
  })
  @ResponseMessage('Lấy danh sách học sinh chưa điểm danh thành công')
  async getUnmarkedStudents(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.attendanceService.getUnmarkedStudents(sessionId);
  }

  // ==================== MARK ATTENDANCE ====================

  @Post(':sessionId/attendance/:studentId')
  @ApiOperation({
    summary: 'Điểm danh một học sinh',
    description: 'Tạo hoặc cập nhật điểm danh cho một học sinh',
  })
  @ApiParam({ name: 'sessionId', description: 'ID của buổi học' })
  @ApiParam({ name: 'studentId', description: 'ID của học sinh' })
  @ApiResponse({
    status: 201,
    description: 'Điểm danh thành công',
  })
  @ResponseMessage('Điểm danh thành công')
  async markAttendance(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.attendanceService.markAttendance(
      sessionId,
      studentId,
      dto as any,
    );
  }

  @Post(':sessionId/attendance/bulk')
  @ApiOperation({
    summary: 'Điểm danh hàng loạt',
    description: 'Điểm danh nhiều học sinh cùng lúc',
  })
  @ApiParam({ name: 'sessionId', description: 'ID của buổi học' })
  @ApiResponse({
    status: 201,
    description: 'Điểm danh hàng loạt thành công',
  })
  @ResponseMessage('Điểm danh hàng loạt thành công')
  async bulkMarkAttendance(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: BulkAttendanceDto,
  ) {
    return this.attendanceService.bulkMarkAttendance(sessionId, dto as any);
  }

  @Post(':sessionId/attendance/:studentId/check-in')
  @ApiOperation({
    summary: 'Check-in nhanh',
    description: 'Đánh dấu học sinh có mặt với thời gian check-in hiện tại',
  })
  @ApiParam({ name: 'sessionId', description: 'ID của buổi học' })
  @ApiParam({ name: 'studentId', description: 'ID của học sinh' })
  @ApiResponse({
    status: 201,
    description: 'Check-in thành công',
  })
  @ResponseMessage('Check-in thành công')
  async quickCheckIn(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
  ) {
    return this.attendanceService.quickCheckIn(sessionId, studentId);
  }

  @Put(':sessionId/attendance/:studentId/check-out')
  @ApiOperation({
    summary: 'Check-out',
    description: 'Cập nhật thời gian check-out cho học sinh',
  })
  @ApiParam({ name: 'sessionId', description: 'ID của buổi học' })
  @ApiParam({ name: 'studentId', description: 'ID của học sinh' })
  @ApiResponse({
    status: 200,
    description: 'Check-out thành công',
  })
  @ResponseMessage('Check-out thành công')
  async quickCheckOut(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
  ) {
    return this.attendanceService.quickCheckOut(sessionId, studentId);
  }

  @Post(':sessionId/attendance/mark-all-absent')
  @ApiOperation({
    summary: 'Đánh dấu tất cả học sinh chưa điểm danh là vắng',
    description:
      'Tự động đánh dấu "vắng mặt" cho tất cả học sinh chưa được điểm danh',
  })
  @ApiParam({ name: 'sessionId', description: 'ID của buổi học' })
  @ApiResponse({
    status: 201,
    description: 'Đánh dấu vắng mặt thành công',
    type: MarkAllAbsentResponseDto,
  })
  @ResponseMessage('Đánh dấu vắng mặt thành công')
  async markAllAbsent(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.attendanceService.markAllAbsent(sessionId);
  }

  @Delete(':sessionId/attendance/:studentId')
  @ApiOperation({
    summary: 'Xóa điểm danh',
    description: 'Xóa bản ghi điểm danh của một học sinh',
  })
  @ApiParam({ name: 'sessionId', description: 'ID của buổi học' })
  @ApiParam({ name: 'studentId', description: 'ID của học sinh' })
  @ApiResponse({
    status: 200,
    description: 'Xóa điểm danh thành công',
  })
  @ResponseMessage('Xóa điểm danh thành công')
  async deleteAttendance(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
  ) {
    return this.attendanceService.deleteAttendance(sessionId, studentId);
  }
}

// ==================== CLASSROOM ATTENDANCE STATS CONTROLLER ====================

@ApiTags('Attendance - Điểm danh')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/classrooms')
export class ClassroomAttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get(':classroomId/attendance/stats')
  @ApiOperation({
    summary: 'Thống kê điểm danh của lớp học',
    description:
      'Trả về thống kê điểm danh tổng hợp của lớp bao gồm tỷ lệ chuyên cần của từng học sinh',
  })
  @ApiParam({ name: 'classroomId', description: 'ID của lớp học' })
  @ApiResponse({
    status: 200,
    description: 'Thống kê điểm danh',
    type: ClassroomAttendanceStatsDto,
  })
  @ResponseMessage('Lấy thống kê điểm danh thành công')
  async getClassroomStats(
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
  ) {
    return this.attendanceService.getClassroomStats(classroomId);
  }

  @Get(':classroomId/students/:studentId/attendance')
  @ApiOperation({
    summary: 'Lịch sử điểm danh của học sinh trong lớp',
    description:
      'Trả về lịch sử điểm danh chi tiết của một học sinh trong lớp, hỗ trợ phân trang và lọc theo thời gian/trạng thái',
  })
  @ApiParam({ name: 'classroomId', description: 'ID của lớp học' })
  @ApiParam({ name: 'studentId', description: 'ID của học sinh' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Trang hiện tại (mặc định: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số bản ghi mỗi trang (mặc định: 20, tối đa: 100)',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: Date,
    description: 'Lọc từ ngày (ISO 8601)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: Date,
    description: 'Lọc đến ngày (ISO 8601)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AttendanceStatusDto,
    description: 'Lọc theo trạng thái điểm danh',
  })
  @ApiResponse({
    status: 200,
    description: 'Lịch sử điểm danh (phân trang)',
    type: PaginatedStudentAttendanceHistoryDto,
  })
  @ResponseMessage('Lấy lịch sử điểm danh thành công')
  async getStudentHistory(
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Query() query: StudentAttendanceHistoryQueryDto,
  ) {
    return this.attendanceService.getStudentHistory(studentId, classroomId, {
      page: query.page,
      limit: query.limit,
      fromDate: query.fromDate,
      toDate: query.toDate,
      status: query.status as any,
    });
  }

  // ==================== STUDENT SELF-SERVICE ====================

  @Get(':classroomId/my-attendance')
  @ApiOperation({
    summary: 'Lịch sử điểm danh của học sinh đang đăng nhập',
    description:
      'Trả về lịch sử điểm danh của học sinh đang đăng nhập trong một lớp học cụ thể',
  })
  @ApiParam({ name: 'classroomId', description: 'ID của lớp học' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Trang hiện tại (mặc định: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số bản ghi mỗi trang (mặc định: 20, tối đa: 100)',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: Date,
    description: 'Lọc từ ngày (ISO 8601)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: Date,
    description: 'Lọc đến ngày (ISO 8601)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AttendanceStatusDto,
    description: 'Lọc theo trạng thái điểm danh',
  })
  @ApiResponse({
    status: 200,
    description: 'Lịch sử điểm danh của bản thân (phân trang)',
    type: PaginatedStudentAttendanceHistoryDto,
  })
  @ResponseMessage('Lấy lịch sử điểm danh thành công')
  async getMyAttendanceHistory(
    @Req() req,
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
    @Query() query: StudentAttendanceHistoryQueryDto,
  ) {
    const studentId = req.user.id;
    return this.attendanceService.getStudentHistory(studentId, classroomId, {
      page: query.page,
      limit: query.limit,
      fromDate: query.fromDate,
      toDate: query.toDate,
      status: query.status as any,
    });
  }
}
