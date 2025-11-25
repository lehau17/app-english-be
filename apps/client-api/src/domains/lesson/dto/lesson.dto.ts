import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DifficultyLevel, ProgressState } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { CreateActivityDto } from '../../activity/dto/activity.dto';

export class CreateLessonDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  orderNo!: number;

  @ApiPropertyOptional({ enum: DifficultyLevel })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  estimatedTime?: number; // minutes

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @ApiProperty({ type: () => [CreateActivityDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @Type(() => CreateActivityDto)
  activities!: CreateActivityDto[];
}

export class UpdateLessonDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  orderNo?: number;
  @ApiPropertyOptional({ enum: DifficultyLevel })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  estimatedTime?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isLocked?: boolean;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];
}

export class FilterLessonRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() courseId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    enum: ['orderNo', 'createdAt', 'title'],
    default: 'orderNo',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'orderNo' | 'createdAt' | 'title' = 'orderNo';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

/** ======= Học theo hub / linear ======= */

export class GetLessonHubsRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() userId?: string;
}

export class ActivityProgressLiteDto {
  @ApiPropertyOptional({ enum: ProgressState })
  @IsOptional()
  state?: ProgressState;
  @ApiPropertyOptional() @IsOptional() @IsInt() score?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() bestScore?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() attemptsCount?: number | null;
  @ApiPropertyOptional() @IsOptional() updatedAt?: Date;
}

export class ActivityWithProgressDto {
  @ApiProperty() id!: string;
  @ApiProperty() lessonId!: string;
  @ApiProperty() type!: string;
  @ApiProperty() orderNo!: number;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() @IsOptional() content?: any;
  @ApiPropertyOptional() @IsOptional() timeLimit?: number | null;
  @ApiPropertyOptional() @IsOptional() maxAttempts?: number | null;
  @ApiPropertyOptional() @IsOptional() passingScore?: number | null;
  @ApiPropertyOptional() @IsOptional() difficulty?: string;
  @ApiPropertyOptional() @IsOptional() points?: number;
  @ApiPropertyOptional() @IsOptional() questionCount?: number;
  @ApiPropertyOptional({ type: ActivityProgressLiteDto })
  @IsOptional()
  progress?: ActivityProgressLiteDto;
}

export class LessonDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() lessonId!: string;
  @ApiProperty() type!: string;
  @ApiProperty() orderNo!: number;
  @ApiProperty() content!: any;
}

export class GetLessonHubsResponseDto {
  @ApiProperty({ type: [ActivityWithProgressDto] })
  games!: ActivityWithProgressDto[];
  @ApiProperty({ type: [ActivityWithProgressDto] })
  exercises!: ActivityWithProgressDto[];
  @ApiProperty({ type: [ActivityWithProgressDto] })
  speaking!: ActivityWithProgressDto[];
  @ApiProperty({ type: [LessonDetailDto] }) media!: LessonDetailDto[];
}

export class NextActivityResponseDto {
  @ApiPropertyOptional({ type: ActivityWithProgressDto })
  nextActivity?: ActivityWithProgressDto | null;
}

export class LessonProgressSummaryDto {
  @ApiProperty() totalActivities!: number;
  @ApiProperty() done!: number;
  @ApiProperty() mastered!: number;
  @ApiProperty() reviewNeeded!: number;
  @ApiProperty() inProgress!: number;
  @ApiProperty() completion!: number; // %
}

/** ======= Gating / Start / Complete ======= */

export class CanStartActivityRequestDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiProperty() @IsUUID() activityId!: string;
}

export class CanStartActivityResponseDto {
  @ApiProperty() allowed!: boolean;
  @ApiPropertyOptional() reason?: string;
  @ApiPropertyOptional({ type: [Object] }) unmet?: any[];
}

export class StartActivityRequestDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiProperty() @IsUUID() activityId!: string;
}

export class StartActivityResponseDto {
  @ApiProperty({ enum: ProgressState }) state!: ProgressState;
  @ApiProperty() activityId!: string;
  @ApiProperty() userId!: string;
}

export class CompleteActivityRequestDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiProperty() @IsUUID() activityId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  score?: number;
  @ApiPropertyOptional({ description: 'Time spent in seconds' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  timeSpentSec?: number;
}

export class CompleteActivityResponseDto {
  @ApiProperty({ enum: ProgressState }) state!: ProgressState;
  @ApiPropertyOptional() @IsOptional() @IsNumber() score?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() bestScore?: number | null;
  @ApiProperty() attemptsCount!: number;
}

/** ======= Next Lesson with Activity ======= */

export class NextLessonWithActivityResponseDto {
  @ApiPropertyOptional()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  courseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  orderNo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  difficulty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  estimatedTime?: number;

  @ApiPropertyOptional()
  @IsOptional()
  isLocked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  objectives?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  updatedAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  activities?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  activity?: any; // Activity with progress
}
