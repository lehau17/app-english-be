import { PayloadToken, ResponseMessage, Roles, RolesGuard } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Notification, UserRole } from '@prisma/client';
import {
  CreateClassroomAnnouncementDto,
  CreateClassroomNotificationDto,
  CreateNotificationDto,
  FilterNotificationRequestDto,
  UpdateNotificationDto,
} from '../dto/notification.dto';
import { NotificationService } from '../service/notification.service';

@ApiTags('Notifications')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/notifications')
export class PrivateNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a notification' })
  @ResponseMessage('Notification created successfully')
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by id' })
  @ResponseMessage('Notification fetched successfully')
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.notificationService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update notification by id' })
  @ResponseMessage('Notification updated successfully')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateNotificationDto,
  ) {
    return this.notificationService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification by id' })
  @ResponseMessage('Notification deleted successfully')
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.notificationService.delete(id);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications (paginated)' })
  @ResponseMessage('Notifications listed successfully')
  list(
    @Query() query: FilterNotificationRequestDto,
  ): Promise<PageResponseDto<Notification>> {
    return this.notificationService.list(query);
  }

  @Post('classrooms/:classroomId/broadcast')
  @ApiOperation({
    summary: 'Teacher broadcast notification to classroom students',
  })
  @ResponseMessage('Classroom notifications created successfully')
  broadcastToClassroom(
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
    @Body() dto: CreateClassroomNotificationDto,
  ) {
    return this.notificationService.broadcastToClassroom(classroomId, dto);
  }

  // ==================== CLASSROOM ANNOUNCEMENT ENDPOINT ====================

  @Post('classroom-announcement')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.teacher)
  @ApiOperation({
    summary: 'Send announcement to all students in a classroom (Admin/Teacher)',
    description:
      'Admin hoặc Teacher có thể gửi thông báo đến tất cả học sinh trong lớp. ' +
      'Notifications sẽ được tạo cho từng học sinh và gửi qua Kafka để xử lý email/push.',
  })
  @ResponseMessage('Classroom announcement sent successfully')
  createClassroomAnnouncement(
    @Body() dto: CreateClassroomAnnouncementDto,
    @PayloadToken('sub') senderUserId: string,
  ) {
    return this.notificationService.createClassroomAnnouncement(
      dto,
      senderUserId,
    );
  }
}
