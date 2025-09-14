import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityType, DifficultyLevel } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsJSON,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { IsNotEmpty, IsObject, Min } from 'class-validator';
import { ACTIVITY_TYPES, ActivityTypeValue } from '../../course/dto';


export class CreateActivityDto {
  // NESTED theo lesson => KHÔNG cần lessonId
  @ApiProperty({ enum: ACTIVITY_TYPES, description: 'Type of the activity.' })
  @IsString()
  @IsIn(ACTIVITY_TYPES as unknown as string[])
  type!: ActivityTypeValue;

  @ApiProperty({ description: 'Order of the activity within the lesson.' })
  @IsInt() @Min(1)
  orderNo!: number;

  @ApiProperty({ description: 'Title of the activity.' })
  @IsString() @IsNotEmpty()
  title!: string;

  @ApiProperty({ type: 'object', description: 'JSON content (shape phụ thuộc type).' })
  @IsObject()
  content!: Record<string, any>; // ví dụ: vocab => { kind:'vocab', data:{ items:[...] } }

  @ApiPropertyOptional({ description: 'Time limit (minutes).' })
  @IsOptional() @IsInt() @Min(1)
  timeLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum number of attempts.' })
  @IsOptional() @IsInt() @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional({ description: 'Passing score (0–100).' })
  @IsOptional() @IsInt() @Min(0)
  passingScore?: number;

  @ApiPropertyOptional({
    enum: DifficultyLevel,
    description: 'Difficulty level of the activity.',
    default: DifficultyLevel.beginner,
  })
  @IsOptional()
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ description: 'XP points', default: 10 })
  @IsOptional() @IsInt() @Min(0)
  points?: number;

  @ApiPropertyOptional({ description: 'Instructions for the activity.' })
  @IsOptional() @IsString()
  instructions?: string;

  @ApiPropertyOptional({ type: [String], description: 'Hints (plain text list).' })
  @IsOptional() @IsArray() @IsString({ each: true })
  hints?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Attached media URLs.' })
  @IsOptional() @IsArray() @IsString({ each: true })
  mediaUrls?: string[];
}
export class UpdateActivityDto {
  @ApiPropertyOptional({ enum: ActivityType, example: ActivityType.listening })
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  orderNo?: number;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsJSON()
  content?: string;
}

export class FilterActivityRequestDto extends RequestPagingDto {
  @ApiPropertyOptional({ description: 'Search by content', example: 'Grammar' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by lessonId',
    example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
  })
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @ApiPropertyOptional({ enum: ActivityType, description: 'Filter by type' })
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;
}
