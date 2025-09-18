import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DifficultyLevel } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ACTIVITY_TYPES, ActivityTypeValue } from '../../course/dto';
import {
  ActivityContent
} from './activity-content-types.dto';

export class AssignmentActivityDto {
  @ApiProperty({ description: 'Internal assignment activity ID', example: 'activity-1' })
  @IsString()
  @IsNotEmpty()
  id!: string

  @ApiProperty({ enum: ACTIVITY_TYPES, description: 'Activity type' })
  @IsEnum(ACTIVITY_TYPES)
  type!: ActivityTypeValue

  @ApiProperty({ description: 'Activity title' })
  @IsString()
  @IsNotEmpty()
  title!: string

  @ApiPropertyOptional({ description: 'Activity instructions' })
  @IsOptional()
  @IsString()
  instructions?: string

  @ApiProperty({ description: 'Activity content (structured based on activity type)' })
  @ValidateNested()
  @Type(() => Object)
  content!: ActivityContent

  @ApiPropertyOptional({ description: 'XP/Points for this activity', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  points?: number

  @ApiPropertyOptional({ description: 'Time limit (minutes)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimit?: number

  @ApiPropertyOptional({ description: 'Maximum attempts allowed' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number

  @ApiPropertyOptional({ description: 'Passing score (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  passingScore?: number

  @ApiPropertyOptional({ enum: DifficultyLevel, description: 'Difficulty level' })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel

  @ApiPropertyOptional({ type: [String], description: 'Hints (plain text)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hints?: string[]
}

export class CreateAssignmentDto {
  @ApiProperty({ description: 'Assignment title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Assignment description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Assignment instructions' })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiProperty({ description: 'Classroom ID where assignment belongs' })
  @IsString()
  @IsNotEmpty()
  classroomId: string;

  @ApiPropertyOptional({ description: 'Due date for assignment', example: '2024-12-31T17:00:00Z' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Total points possible', minimum: 1, default: 100 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  totalPoints?: number = 100;

  @ApiPropertyOptional({ description: 'Time limit in minutes' })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  timeLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum attempts allowed', minimum: 1, default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  maxAttempts?: number = 1;

  @ApiPropertyOptional({ description: 'Publish assignment immediately', default: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isPublished?: boolean = false;

  @ApiPropertyOptional({ description: 'Assign to specific students (user IDs)', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assignedTo?: string[] = [];

  @ApiProperty({ description: 'Activities in this assignment', type: [AssignmentActivityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentActivityDto)
  activities!: AssignmentActivityDto[];

  @ApiPropertyOptional({ description: 'Custom content as JSON' })
  @IsObject()
  @IsOptional()
  customContent?: any;
}
