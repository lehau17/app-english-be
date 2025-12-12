import { DifficultyLevel, StepStatus } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for updating a learning path step
 */
export class UpdateStepDto {
  @IsOptional()
  @IsEnum(StepStatus)
  status?: StepStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  score?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  completedAt?: Date;

  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpent?: number; // seconds

  @IsOptional()
  @IsInt()
  @Min(0)
  attemptCount?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  lastAttemptedAt?: Date;

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

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;
}
