import { ResponseMessage } from '@app/shared';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateSessionTypeChangeRequestDto,
  QuerySessionTypeChangeRequestDto,
  ReviewSessionTypeChangeRequestDto,
  SessionTypeChangeRequestResponseDto,
} from '../dto/session-type-change.dto';
import { SessionInstructorGuard } from '../guards/session-instructor.guard';
import { SessionTypeChangeRequestService } from '../service/session-type-change-request.service';

// ==================== TEACHER CONTROLLER ====================

@ApiTags('Session Type Change Requests - Teacher')
@ApiBearerAuth()
@Controller('private/v1/sessions')
export class SessionTypeChangeRequestTeacherController {
  constructor(
    private readonly service: SessionTypeChangeRequestService,
  ) {}

  @Post(':sessionId/request-type-change')
  @UseGuards(SessionInstructorGuard)
  @ApiOperation({ summary: 'Request session type change (Teacher only)' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({
    status: 201,
    description: 'Request created successfully',
    type: SessionTypeChangeRequestResponseDto,
  })
  @ResponseMessage('Session type change request created')
  async createRequest(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: CreateSessionTypeChangeRequestDto,
    @Req() req,
  ) {
    return this.service.createRequest(sessionId, req.user.sub, dto);
  }

  @Get('my/type-change-requests')
  @ApiOperation({ summary: 'Get my session type change requests' })
  @ApiResponse({
    status: 200,
    description: 'List of my requests',
    type: [SessionTypeChangeRequestResponseDto],
  })
  @ResponseMessage('Your session type change requests')
  async getMyRequests(@Req() req, @Query() query: QuerySessionTypeChangeRequestDto) {
    return this.service.getRequestsByTeacher(req.user.sub, query);
  }
}

// ==================== ADMIN CONTROLLER ====================

@ApiTags('Session Type Change Requests - Admin')
@ApiBearerAuth()
@Controller('private/v1')
export class SessionTypeChangeRequestAdminController {
  constructor(
    private readonly service: SessionTypeChangeRequestService,
  ) {}

  @Get('sessions/:sessionId/type-change-requests')
  @ApiOperation({ summary: 'Get session type change requests for a session (Admin)' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({
    status: 200,
    description: 'List of requests',
    type: [SessionTypeChangeRequestResponseDto],
  })
  @ResponseMessage('Session type change requests')
  async getSessionRequests(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Query() query: QuerySessionTypeChangeRequestDto,
  ) {
    return this.service.getRequestsBySession(sessionId, query);
  }

  @Get('type-change-requests/pending')
  @ApiOperation({ summary: 'Get all pending type change requests (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'List of pending requests',
    type: [SessionTypeChangeRequestResponseDto],
  })
  @ResponseMessage('Pending session type change requests')
  async getPendingRequests() {
    return this.service.getPendingRequests();
  }

  @Get('type-change-requests/:id')
  @ApiOperation({ summary: 'Get type change request details (Admin)' })
  @ApiParam({ name: 'id', description: 'Request ID' })
  @ApiResponse({
    status: 200,
    description: 'Request details',
    type: SessionTypeChangeRequestResponseDto,
  })
  @ResponseMessage('Type change request details')
  async getRequestById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getRequestById(id);
  }

  @Put('type-change-requests/:id/review')
  @ApiOperation({ summary: 'Review (approve/reject) type change request (Admin)' })
  @ApiParam({ name: 'id', description: 'Request ID' })
  @ApiResponse({
    status: 200,
    description: 'Request reviewed successfully',
    type: SessionTypeChangeRequestResponseDto,
  })
  @ResponseMessage('Type change request reviewed')
  async reviewRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewSessionTypeChangeRequestDto,
    @Req() req,
  ) {
    return this.service.reviewRequest(id, req.user.sub, dto);
  }
}
