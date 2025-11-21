import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationType, UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsJSON,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: NotificationType, example: NotificationType.system })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ example: 'New message' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'You have a new message' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsJSON()
  data?: string;

  @ApiProperty({
    enum: NotificationChannel,
    example: NotificationChannel.socket,
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;
}

export class CreateClassroomNotificationDto {
  @ApiProperty({ enum: NotificationType, example: NotificationType.system })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ example: 'Class announcement' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Exam this Friday at 9AM' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ example: '{}' })
  @IsOptional()
  @IsJSON()
  data?: string;

  @ApiProperty({
    enum: NotificationChannel,
    example: NotificationChannel.socket,
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;
}

export class UpdateNotificationDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  read?: boolean;
}

export class FilterNotificationRequestDto extends RequestPagingDto {
  @ApiPropertyOptional({
    description: 'Filter by userId',
    example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    description: 'Filter by channel',
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ description: 'Filter by read status' })
  @IsOptional()
  @IsBoolean()
  read?: boolean;
}

// ==================== CLASSROOM ANNOUNCEMENT DTOs ====================

export class CreateClassroomAnnouncementDto {
  @ApiProperty({
    description: 'ID của lớp học cần gửi thông báo',
    example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
  })
  @IsUUID()
  classroomId: string;

  @ApiProperty({
    description: 'Tiêu đề thông báo',
    example: 'Thông báo nghỉ học',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Nội dung chi tiết thông báo',
    example: 'Lớp học ngày mai sẽ nghỉ do giáo viên có việc đột xuất.',
  })
  @IsString()
  content: string;
}

export class CreateBroadcastNotificationDto {
  @ApiProperty({
    description: 'Target audience for the notification',
    enum: ['all', 'role', 'users'],
    example: 'all',
  })
  @IsEnum(['all', 'role', 'users'])
  target: 'all' | 'role' | 'users';

  @ApiPropertyOptional({
    description: 'Target roles (required if target is role)',
    enum: UserRole,
    isArray: true,
    example: [UserRole.student],
  })
  @IsOptional()
  @IsEnum(UserRole, { each: true })
  targetRoles?: UserRole[];

  @ApiPropertyOptional({
    description: 'Target user IDs (required if target is users)',
    type: [String],
    example: ['uuid1', 'uuid2'],
  })
  @IsOptional()
  @IsUUID('4', { each: true })
  targetUserIds?: string[];

  @ApiProperty({ example: 'System Maintenance' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'The system will be down for maintenance...' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ example: '{}' })
  @IsOptional()
  @IsJSON()
  data?: string;

  @ApiProperty({
    enum: NotificationChannel,
    example: NotificationChannel.in_app,
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;
}

