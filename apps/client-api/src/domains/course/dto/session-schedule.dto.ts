import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class SessionActivityDto {
  @ApiProperty({
    example: 'activity-uuid',
    description:
      'Activity ID (UUID) or activity reference (L1A2 format for course creation)',
  })
  @IsString()
  @IsNotEmpty()
  activityId: string;

  @ApiProperty({ example: 1, description: 'Thứ tự hoạt động trong buổi học' })
  @IsInt()
  @Min(1)
  orderNo: number;
}

export class CreateSessionScheduleDto {
  @ApiProperty({ example: 1, description: 'Số thứ tự buổi học' })
  @IsInt()
  @Min(1)
  sessionNumber: number;

  @ApiPropertyOptional({ example: 'Buổi 1: Giới thiệu ngữ pháp cơ bản' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ example: 'Học từ vựng và ngữ pháp cơ bản' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiProperty({
    type: [SessionActivityDto],
    description: 'Danh sách hoạt động trong buổi học',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => SessionActivityDto)
  activities: SessionActivityDto[];
}

export class UpdateSessionScheduleDto {
  @ApiPropertyOptional({ example: 1, description: 'Số thứ tự buổi học' })
  @IsOptional()
  @IsInt()
  @Min(1)
  sessionNumber?: number;

  @ApiPropertyOptional({
    example: 'Buổi 1: Giới thiệu ngữ pháp cơ bản (cập nhật)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({
    example: 'Học từ vựng và ngữ pháp cơ bản với phương pháp mới',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({
    type: [SessionActivityDto],
    description: 'Danh sách hoạt động trong buổi học',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionActivityDto)
  activities?: SessionActivityDto[];
}
