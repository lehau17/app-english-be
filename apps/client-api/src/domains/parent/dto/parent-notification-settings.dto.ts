import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class NotificationSettingsDto {
  @ApiProperty({
    description: 'Bật/tắt thông báo cho parent',
    default: true
  })
  @IsBoolean()
  notificationsEnabled: boolean;

  @ApiProperty({
    description: 'Các loại thông báo parent muốn nhận',
    type: [String],
    default: ['achievement', 'progress', 'activity_completed', 'streak_lost', 'daily_goal_reached']
  })
  @IsArray()
  @IsString({ each: true })
  notificationTypes: string[];

  @ApiProperty({
    description: 'Lịch gửi thông báo',
    enum: ['realtime', 'daily_summary', 'weekly_summary', 'disabled'],
    default: 'realtime'
  })
  @IsString()
  notificationSchedule: string;

  @ApiPropertyOptional({
    description: 'Giờ bắt đầu không gửi thông báo (format: HH:mm)',
    example: '22:00'
  })
  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @ApiPropertyOptional({
    description: 'Giờ kết thúc không gửi thông báo (format: HH:mm)',
    example: '07:00'
  })
  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @ApiProperty({
    description: 'Timezone',
    default: 'Asia/Ho_Chi_Minh'
  })
  @IsString()
  timezone: string;

  @ApiProperty({
    description: 'Ngưỡng tiến độ tối thiểu để thông báo (%)',
    default: 10
  })
  @IsInt()
  @Min(0)
  minProgressThreshold: number;

  @ApiProperty({
    description: 'Số ngày streak tối thiểu để thông báo',
    default: 3
  })
  @IsInt()
  @Min(1)
  streakNotificationDays: number;

  @ApiProperty({
    description: 'Thông báo khi hoàn thành activity',
    default: true
  })
  @IsBoolean()
  activityCompletionNotify: boolean;

  @ApiProperty({
    description: 'Thông báo khi đạt mục tiêu hàng ngày',
    default: true
  })
  @IsBoolean()
  goalReachedNotify: boolean;
}

export class UpdateParentChildSettingsDto extends NotificationSettingsDto {
  @ApiPropertyOptional({ description: 'Có thể xem tiến độ của con' })
  @IsOptional()
  @IsBoolean()
  canViewProgress?: boolean;

  @ApiPropertyOptional({ description: 'Có thể đặt mục tiêu cho con' })
  @IsOptional()
  @IsBoolean()
  canSetGoals?: boolean;

  @ApiPropertyOptional({ description: 'Có thể kiểm soát thời gian học' })
  @IsOptional()
  @IsBoolean()
  canControlTime?: boolean;

  @ApiPropertyOptional({ description: 'Giới hạn thời gian học hàng ngày (phút)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyTimeLimit?: number;

  @ApiPropertyOptional({ description: 'Giờ đi ngủ (format: HH:mm)', example: '21:30' })
  @IsOptional()
  @IsString()
  bedtimeStart?: string;

  @ApiPropertyOptional({ description: 'Giờ thức dậy (format: HH:mm)', example: '06:30' })
  @IsOptional()
  @IsString()
  bedtimeEnd?: string;

  @ApiPropertyOptional({ description: 'Các activity được phép', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedActivities?: string[];

  @ApiPropertyOptional({ description: 'Nội dung bị chặn', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedContent?: string[];
}
