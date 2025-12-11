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
  CreateMakeupRequestDto,
  MakeupRequestResponseDto,
  PaginatedMakeupRequestsDto,
  QueryMakeupRequestDto,
  ReviewMakeupRequestDto,
} from '../dto/makeup-request.dto';
import { MakeupRequestService } from '../services/makeup-request.service';

// ==================== STUDENT CONTROLLER ====================

@ApiTags('Makeup Attendance Requests - Student')
@ApiBearerAuth()
@Controller('private/v1/sessions')
export class MakeupRequestStudentController {
  constructor(private readonly makeupRequestService: MakeupRequestService) {}

  @Post(':sessionId/makeup-request')
  @ApiOperation({ summary: 'Tạo yêu cầu điểm danh bù' })
  @ApiParam({ name: 'sessionId', description: 'ID buổi học' })
  @ApiResponse({
    status: 201,
    description: 'Yêu cầu đã được tạo',
    type: MakeupRequestResponseDto,
  })
  @ResponseMessage('Đã gửi yêu cầu điểm danh bù')
  async createRequest(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: CreateMakeupRequestDto,
    @Req() req,
  ) {
    return this.makeupRequestService.createRequest(
      sessionId,
      req.user.sub,
      dto,
    );
  }

  @Get('my/makeup-requests')
  @ApiOperation({ summary: 'Xem danh sách yêu cầu của bản thân' })
  @ApiResponse({
    status: 200,
    type: PaginatedMakeupRequestsDto,
  })
  @ResponseMessage('Danh sách yêu cầu điểm danh bù của bạn')
  async getMyRequests(@Req() req, @Query() query: QueryMakeupRequestDto) {
    return this.makeupRequestService.getMyRequests(req.user.sub, query);
  }

  @Delete('makeup-requests/:id')
  @ApiOperation({ summary: 'Hủy yêu cầu điểm danh bù (chỉ khi pending)' })
  @ApiParam({ name: 'id', description: 'ID yêu cầu' })
  @ApiResponse({ status: 200, description: 'Đã hủy yêu cầu' })
  @ResponseMessage('Đã hủy yêu cầu điểm danh bù')
  async cancelRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req,
  ) {
    return this.makeupRequestService.cancelRequest(id, req.user.sub);
  }
}

// ==================== TEACHER/ADMIN CONTROLLER ====================

@ApiTags('Makeup Attendance Requests - Teacher/Admin')
@ApiBearerAuth()
@Controller('private/v1')
export class MakeupRequestAdminController {
  constructor(private readonly makeupRequestService: MakeupRequestService) {}

  @Get('sessions/:sessionId/makeup-requests')
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu của buổi học' })
  @ApiParam({ name: 'sessionId', description: 'ID buổi học' })
  @ApiResponse({
    status: 200,
    type: PaginatedMakeupRequestsDto,
  })
  @ResponseMessage('Danh sách yêu cầu điểm danh bù của buổi học')
  async getSessionRequests(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Query() query: QueryMakeupRequestDto,
  ) {
    return this.makeupRequestService.getSessionRequests(sessionId, query);
  }

  @Get('classrooms/:classroomId/makeup-requests')
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu của lớp học' })
  @ApiParam({ name: 'classroomId', description: 'ID lớp học' })
  @ApiResponse({
    status: 200,
    type: PaginatedMakeupRequestsDto,
  })
  @ResponseMessage('Danh sách yêu cầu điểm danh bù của lớp học')
  async getClassroomRequests(
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
    @Query() query: QueryMakeupRequestDto,
  ) {
    return this.makeupRequestService.getClassroomRequests(classroomId, query);
  }

  @Get('makeup-requests/:id')
  @ApiOperation({ summary: 'Xem chi tiết yêu cầu' })
  @ApiParam({ name: 'id', description: 'ID yêu cầu' })
  @ApiResponse({
    status: 200,
    type: MakeupRequestResponseDto,
  })
  @ResponseMessage('Chi tiết yêu cầu điểm danh bù')
  async getRequestById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.makeupRequestService.getRequestById(id);
  }

  @Put('makeup-requests/:id/review')
  @ApiOperation({ summary: 'Duyệt/Từ chối yêu cầu điểm danh bù' })
  @ApiParam({ name: 'id', description: 'ID yêu cầu' })
  @ApiResponse({
    status: 200,
    description: 'Đã xử lý yêu cầu',
    type: MakeupRequestResponseDto,
  })
  @ResponseMessage('Đã xử lý yêu cầu điểm danh bù')
  async reviewRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewMakeupRequestDto,
    @Req() req,
  ) {
    return this.makeupRequestService.reviewRequest(id, req.user.sub, dto);
  }
}
