import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationType } from '@prisma/client';
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

  @ApiProperty({ enum: NotificationChannel, example: NotificationChannel.socket })
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
