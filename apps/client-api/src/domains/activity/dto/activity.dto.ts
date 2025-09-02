import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityType, DifficultyLevel } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsJSON,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { IsNotEmpty, IsObject, Min } from 'class-validator';

export class CreateActivityDto {
  @ApiProperty({
    enum: ActivityType,
    description: 'Type of the activity.',
  })
  @IsEnum(ActivityType)
  @IsNotEmpty()
  type: ActivityType;

  @ApiProperty({ description: 'Order of the activity within the lesson.' })
  @IsInt()
  @Min(0)
  orderNo: number;

  @ApiProperty({ description: 'Title of the activity.' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    type: 'object',
    description: 'JSON content for the activity.',
  })
  @IsObject()
  @IsNotEmpty()
  content: any;

  @ApiPropertyOptional({
    description: 'Time limit for the activity in seconds.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimit?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of attempts allowed.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional({
    description: 'Passing score required for the activity.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  passingScore?: number;

  @ApiPropertyOptional({
    enum: DifficultyLevel,
    description: 'Difficulty level of the activity.',
    default: DifficultyLevel.beginner,
  })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({
    description: 'XP points awarded for completing the activity.',
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  points?: number;

  @ApiPropertyOptional({ description: 'Instructions for the activity.' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({
    type: 'object',
    description: 'JSON object containing hints.',
  })
  @IsOptional()
  @IsObject()
  hints?: any;

  @ApiPropertyOptional({
    type: 'object',
    description: 'JSON object containing media URLs.',
  })
  @IsOptional()
  @IsObject()
  mediaUrls?: any;
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
