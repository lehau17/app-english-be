import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgressState } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID } from 'class-validator';

export class CreateProgressDto {
  @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
  @IsUUID()
  activityId: string;

  @ApiProperty({ enum: ProgressState, example: ProgressState.in_progress })
  @IsEnum(ProgressState)
  state: ProgressState;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  score?: number;

  @ApiPropertyOptional({ example: 3600 })
  @IsOptional()
  @IsInt()
  timeSpentSec?: number;
}

export class UpdateProgressDto {
  @ApiPropertyOptional({ enum: ProgressState, example: ProgressState.done })
  @IsOptional()
  @IsEnum(ProgressState)
  state?: ProgressState;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  score?: number;

  @ApiPropertyOptional({ example: 3600 })
  @IsOptional()
  @IsInt()
  timeSpentSec?: number;
}

export class UpdateProgressTimeSpentDto {
  @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
  @IsUUID()
  activityId: string;

  @ApiProperty({ example: 3600, description: 'Time spent in seconds (will be added to existing timeSpentSec)' })
  @IsInt()
  timeSpentSec: number;
}

export class FilterProgressRequestDto extends RequestPagingDto {
  @ApiPropertyOptional({
    description: 'Filter by userId',
    example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by activityId',
    example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
  })
  @IsOptional()
  @IsUUID()
  activityId?: string;

  @ApiPropertyOptional({ enum: ProgressState, description: 'Filter by state' })
  @IsOptional()
  @IsEnum(ProgressState)
  state?: ProgressState;
}
