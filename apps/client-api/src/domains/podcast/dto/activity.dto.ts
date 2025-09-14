import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ListeningActivityType } from '../entities/podcast-activity.entity';

export class CreateActivityDto {
  @ApiProperty({ description: 'Podcast ID' })
  @IsString()
  podcastId: string;

  @ApiProperty({ enum: ListeningActivityType })
  @IsEnum(ListeningActivityType)
  type: ListeningActivityType;

  @ApiProperty({ description: 'Activity title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Activity description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Order in podcast' })
  @IsNumber()
  @Min(1)
  orderNo: number;

  @ApiPropertyOptional({ description: 'Time limit in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  timeLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum attempts allowed', default: 3 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAttempts?: number = 3;

  @ApiPropertyOptional({ description: 'Passing score percentage', default: 70 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingScore?: number = 70;

  @ApiPropertyOptional({ description: 'Points awarded', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  points?: number = 10;

  @ApiProperty({ description: 'Activity content (JSON)', type: 'object' })
  @IsObject()
  content: any;

  @ApiPropertyOptional({ description: 'Instructions' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ type: [String], description: 'Hints' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hints?: string[] = [];

  @ApiPropertyOptional({ description: 'Is activity locked', default: false })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean = false;

  @ApiPropertyOptional({ description: 'Activity ID that must be completed first' })
  @IsOptional()
  @IsString()
  unlockAfter?: string;

  @ApiPropertyOptional({ description: 'Is premium content', default: false })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean = false;
}

export class UpdateActivityDto {
  @ApiPropertyOptional({ description: 'Activity title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Activity description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Order in podcast' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  orderNo?: number;

  @ApiPropertyOptional({ description: 'Time limit in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  timeLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum attempts allowed' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional({ description: 'Passing score percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @ApiPropertyOptional({ description: 'Points awarded' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  points?: number;

  @ApiPropertyOptional({ description: 'Activity content (JSON)', type: 'object' })
  @IsOptional()
  @IsObject()
  content?: any;

  @ApiPropertyOptional({ description: 'Instructions' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ type: [String], description: 'Hints' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hints?: string[];

  @ApiPropertyOptional({ description: 'Is activity locked' })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @ApiPropertyOptional({ description: 'Activity ID that must be completed first' })
  @IsOptional()
  @IsString()
  unlockAfter?: string;

  @ApiPropertyOptional({ description: 'Is premium content' })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional({ description: 'Is activity active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SubmitAttemptDto {
  @ApiProperty({ description: 'User answers (JSON)', type: 'object' })
  @IsObject()
  answers: any;

  @ApiPropertyOptional({ description: 'Time spent in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpent?: number;

  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object' })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class GetActivitiesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by type' })
  @IsOptional()
  @IsEnum(ListeningActivityType)
  type?: ListeningActivityType;

  @ApiPropertyOptional({ description: 'Include user progress', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeProgress?: boolean = false;

  @ApiPropertyOptional({ description: 'Show only active activities', default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean = true;
}

export class GetAttemptsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Sort by', default: 'newest' })
  @IsOptional()
  @IsString()
  sortBy?: 'newest' | 'oldest' | 'score' = 'newest';
}
