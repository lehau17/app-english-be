import { DifficultyLevel, StepStatus } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
} from 'class-validator';

/**
 * DTO for creating a single learning path step
 */
export class CreateStepDto {
  @IsOptional()
  @IsString()
  activityId?: string; // Existing activity reference

  @IsOptional()
  @IsString()
  variantId?: string; // AI-generated variant reference

  @IsInt()
  @Min(0)
  orderNo: number; // Position in queue

  @IsEnum(DifficultyLevel)
  difficulty: DifficultyLevel;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(StepStatus)
  status?: StepStatus;

  @IsOptional()
  @IsBoolean()
  wasSkipped?: boolean;

  @IsOptional()
  @IsString()
  skipReason?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recommendedNext?: string[];

  @IsOptional()
  @IsString()
  adaptivityReason?: string;
}
