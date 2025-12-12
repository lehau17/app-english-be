import { DifficultyLevel } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateStepDto } from './create-step.dto';

/**
 * DTO for creating a learning path with initial steps
 */
export class CreateLearningPathWithStepsDto {
  @IsString()
  name: string;

  @IsEnum(DifficultyLevel)
  targetLevel: DifficultyLevel;

  @IsArray()
  @IsString({ each: true })
  focusAreas: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  timeframe?: number; // days

  @IsOptional()
  @IsBoolean()
  isDynamic?: boolean; // Default true in schema

  @IsOptional()
  @IsString()
  classroomId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStepDto)
  steps?: CreateStepDto[]; // Initial steps

  @IsOptional()
  customContent?: any; // JSON field
}
