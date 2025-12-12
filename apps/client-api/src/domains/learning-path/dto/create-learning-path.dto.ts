import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { DifficultyLevel } from '@prisma/client';

export class CreateLearningPathDto {
  @ApiProperty({ description: 'Learning path name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Target difficulty level', enum: DifficultyLevel })
  @IsEnum(DifficultyLevel)
  targetLevel!: DifficultyLevel;

  @ApiProperty({ description: 'Focus areas', type: [String] })
  @IsArray()
  @IsString({ each: true })
  focusAreas!: string[];

  @ApiProperty({ description: 'Course IDs in order', type: [String] })
  @IsArray()
  @IsString({ each: true })
  courseIds!: string[];

  @ApiProperty({ description: 'Timeframe in days', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeframe?: number;

  @ApiProperty({ description: 'Custom content', required: false })
  @IsOptional()
  customContent?: Record<string, any>;
}



