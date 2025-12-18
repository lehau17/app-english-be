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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateRescheduleRequestDto,
  PaginatedRescheduleRequestsDto,
  QueryRescheduleRequestDto,
  RescheduleRequestResponseDto,
  ReviewRescheduleRequestDto,
  UpdateRescheduleRequestDto,
} from '../dto/reschedule-request.dto';
import { RescheduleRequestService } from '../services/reschedule-request.service';

// ==================== TEACHER CONTROLLER ====================

@ApiTags('Session Reschedule Requests - Teacher')
@ApiBearerAuth()
@Controller('private/v1/sessions')
export class RescheduleRequestTeacherController {
  constructor(
    private readonly rescheduleRequestService: RescheduleRequestService,
  ) { }

  @Post(':sessionId/reschedule-request')
  @ApiOperation({ summary: 'Tạo yêu cầu dời lịch buổi học' })
  @ApiParam({ name: 'sessionId', description: 'ID buổi học' })
  @ApiResponse({
    status: 201,
    description: 'Yêu cầu đã được tạo',
    type: RescheduleRequestResponseDto,
  })
  @ResponseMessage('Đã gửi yêu cầu dời lịch buổi học')
  async createRequest(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: CreateRescheduleRequestDto,
    @Req() req,
  ) {
    return this.rescheduleRequestService.createRequest(
      sessionId,
      req.user.sub,
      dto,
    );
  }

  @Get('my/reschedule-requests')
  @ApiOperation({ summary: 'Xem danh sách yêu cầu dời lịch của bản thân' })
  @ApiResponse({
    status: 200,
    type: PaginatedRescheduleRequestsDto,
  })
  @ResponseMessage('Danh sách yêu cầu dời lịch của bạn')
  async getMyRequests(@Req() req, @Query() query: QueryRescheduleRequestDto) {
    return this.rescheduleRequestService.getMyRequests(req.user.sub, query);
  }

  @Get(':sessionId/reschedule-request/pending')
  @ApiOperation({ summary: 'Lấy yêu cầu dời lịch đang chờ duyệt của buổi học' })
  @ApiParam({ name: 'sessionId', description: 'ID buổi học' })
  @ApiResponse({
    status: 200,
    description: 'Yêu cầu dời lịch (nếu có)',
    type: RescheduleRequestResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Không có yêu cầu nào',
    schema: { type: 'null' },
  })
  @ResponseMessage('Yêu cầu dời lịch đang chờ duyệt')
  async getPendingRequestBySession(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Req() req,
  ) {
    return this.rescheduleRequestService.getPendingRequestBySession(
      sessionId,
      req.user.sub,
    );
  }

  @Put('reschedule-requests/:id')
  @ApiOperation({ summary: 'Chỉnh sửa yêu cầu dời lịch (chỉ khi pending)' })
  @ApiParam({ name: 'id', description: 'ID yêu cầu' })
  @ApiResponse({
    status: 200,
    description: 'Đã cập nhật yêu cầu',
    type: RescheduleRequestResponseDto,
  })
  @ResponseMessage('Đã cập nhật yêu cầu dời lịch')
  async updateRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRescheduleRequestDto,
    @Req() req,
  ) {
    return this.rescheduleRequestService.updateRequest(id, req.user.sub, dto);
  }

  @Put('reschedule-requests/:id/cancel')
  @ApiOperation({ summary: 'Hủy/Rút lại yêu cầu dời lịch (chỉ khi pending)' })
  @ApiParam({ name: 'id', description: 'ID yêu cầu' })
  @ApiResponse({ status: 200, description: 'Đã hủy yêu cầu' })
  @ResponseMessage('Đã hủy yêu cầu dời lịch')
  async cancelRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req,
  ) {
    return this.rescheduleRequestService.cancelRequest(id, req.user.sub);
  }
}

// ==================== ADMIN CONTROLLER ====================

@ApiTags('Session Reschedule Requests - Admin')
@ApiBearerAuth()
@Controller('private/v1')
export class RescheduleRequestAdminController {
  constructor(
    private readonly rescheduleRequestService: RescheduleRequestService,
  ) { }

  @Get('sessions/:sessionId/reschedule-requests')
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu dời lịch của buổi học' })
  @ApiParam({ name: 'sessionId', description: 'ID buổi học' })
  @ApiResponse({
    status: 200,
    type: PaginatedRescheduleRequestsDto,
  })
  @ResponseMessage('Danh sách yêu cầu dời lịch của buổi học')
  async getSessionRequests(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Query() query: QueryRescheduleRequestDto,
  ) {
    return this.rescheduleRequestService.getSessionRequests(sessionId, query);
  }

  @Get('classrooms/:classroomId/reschedule-requests')
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu dời lịch của lớp học' })
  @ApiParam({ name: 'classroomId', description: 'ID lớp học' })
  @ApiResponse({
    status: 200,
    type: PaginatedRescheduleRequestsDto,
  })
  @ResponseMessage('Danh sách yêu cầu dời lịch của lớp học')
  async getClassroomRequests(
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
    @Query() query: QueryRescheduleRequestDto,
  ) {
    return this.rescheduleRequestService.getClassroomRequests(
      classroomId,
      query,
    );
  }

  @Get('reschedule-requests')
  @ApiOperation({ summary: 'Lấy danh sách tất cả yêu cầu dời lịch (Admin)' })
  @ApiResponse({
    status: 200,
    type: PaginatedRescheduleRequestsDto,
  })
  @ResponseMessage('Danh sách yêu cầu dời lịch')
  async getAllRequests(@Query() query: QueryRescheduleRequestDto) {
    return this.rescheduleRequestService.getAllRequests(query);
  }

  @Get('reschedule-requests/pending')
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu đang chờ duyệt (Admin)' })
  @ApiResponse({
    status: 200,
    type: PaginatedRescheduleRequestsDto,
  })
  @ResponseMessage('Danh sách yêu cầu dời lịch đang chờ duyệt')
  async getPendingRequests(@Query() query: QueryRescheduleRequestDto) {
    return this.rescheduleRequestService.getPendingRequests(query);
  }

  @Get('reschedule-requests/:id')
  @ApiOperation({ summary: 'Xem chi tiết yêu cầu dời lịch' })
  @ApiParam({ name: 'id', description: 'ID yêu cầu' })
  @ApiResponse({
    status: 200,
    type: RescheduleRequestResponseDto,
  })
  @ResponseMessage('Chi tiết yêu cầu dời lịch')
  async getRequestById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.rescheduleRequestService.getRequestById(id);
  }

  @Put('reschedule-requests/:id/review')
  @ApiOperation({ summary: 'Duyệt/Từ chối yêu cầu dời lịch' })
  @ApiParam({ name: 'id', description: 'ID yêu cầu' })
  @ApiResponse({
    status: 200,
    description: 'Đã xử lý yêu cầu',
    type: RescheduleRequestResponseDto,
  })
  @ResponseMessage('Đã xử lý yêu cầu dời lịch')
  async reviewRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewRescheduleRequestDto,
    @Req() req,
  ) {
    return this.rescheduleRequestService.reviewRequest(id, req.user.sub, dto);
  }
}
