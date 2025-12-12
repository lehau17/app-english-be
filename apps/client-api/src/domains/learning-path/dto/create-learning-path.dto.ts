import { ApiProperty } from '@nestjs/swagger';
import { DifficultyLevel } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateLearningPathDto {
  @ApiProperty({ description: 'Learning path name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Classroom ID (optional)', required: false })
  @IsOptional()
  @IsString()
  classroomId?: string;

  @ApiProperty({
    description: 'Target difficulty level',
    enum: DifficultyLevel,
  })
  @IsEnum(DifficultyLevel)
  targetLevel!: DifficultyLevel;

  @ApiProperty({ description: 'Focus areas', type: [String] })
  @IsArray()
  @IsString({ each: true })
  focusAreas!: string[];

  @ApiProperty({ description: 'Activity IDs in order', type: [String] })
  @IsArray()
  @IsString({ each: true })
  activityIds!: string[];

  @ApiProperty({ description: 'Timeframe in days', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeframe?: number;

  @ApiProperty({ description: 'Custom content', required: false })
  @IsOptional()
  customContent?: Record<string, any>;
}
