import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';

export class ActivityContentDto {
  @ApiProperty({ description: 'Activity ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Activity type', enum: ['vocab', 'grammar', 'reading', 'writing', 'listening', 'speaking', 'quiz', 'fill_blank', 'matching'] })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Activity title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Activity instructions' })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiProperty({ description: 'Activity content as JSON' })
  @IsObject()
  content: any;

  @ApiPropertyOptional({ description: 'Points for this activity', minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  points?: number;

  @ApiPropertyOptional({ description: 'Time limit in minutes' })
  @IsInt()
  @Min(1)
  @IsOptional()
  timeLimit?: number;
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

  @ApiProperty({ description: 'Activities in this assignment', type: [ActivityContentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityContentDto)
  activities: ActivityContentDto[];

  @ApiPropertyOptional({ description: 'Custom content as JSON' })
  @IsObject()
  @IsOptional()
  customContent?: any;
}
