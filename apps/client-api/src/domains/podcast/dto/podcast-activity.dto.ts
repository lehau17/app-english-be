import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength
} from 'class-validator';

export enum PodcastActivityType {
  VOCABULARY = 'vocabulary',
  LISTENING = 'listening',
  PRONUNCIATION = 'pronunciation',
  COMPREHENSION = 'comprehension',
  SUMMARY = 'summary',
  DISCUSSION = 'discussion',
}

export class CreateActivityDto {
  @ApiProperty({ description: 'Activity title', minLength: 1 })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiPropertyOptional({ description: 'Activity description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Podcast ID' })
  @IsString()
  @IsUUID()
  podcastId: string;

  @ApiProperty({
    description: 'Activity type',
    enum: PodcastActivityType
  })
  @IsEnum(PodcastActivityType)
  type: PodcastActivityType;

  @ApiProperty({ description: 'Activity content (JSON format)' })
  content: any;

  @ApiPropertyOptional({ description: 'Start time in seconds', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  startTime?: number;

  @ApiPropertyOptional({ description: 'End time in seconds', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  endTime?: number;

  @ApiPropertyOptional({ description: 'Points awarded', minimum: 0, default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number = 10;

  @ApiPropertyOptional({ description: 'Maximum attempts allowed', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional({ description: 'Whether activity is required', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isRequired?: boolean = false;
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {
  @ApiPropertyOptional({ description: 'Activity status', enum: ['active', 'inactive'] })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class GetActivitiesQueryDto {
  @ApiProperty({ description: 'Podcast ID to get activities for' })
  @IsString()
  @IsUUID()
  podcastId: string;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by activity type',
    enum: PodcastActivityType
  })
  @IsOptional()
  @IsEnum(PodcastActivityType)
  type?: PodcastActivityType;

  @ApiPropertyOptional({ description: 'Filter by required status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['newest', 'oldest', 'startTime'],
    default: 'startTime'
  })
  @IsOptional()
  @IsEnum(['newest', 'oldest', 'startTime'])
  sortBy?: 'newest' | 'oldest' | 'startTime' = 'startTime';
}
