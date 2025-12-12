import { ApiPropertyOptional } from '@nestjs/swagger';
import { DifficultyLevel } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GenerateLearningPathForNewStudentDto {
  @ApiPropertyOptional({
    description: 'Target difficulty level',
    enum: DifficultyLevel,
    example: DifficultyLevel.intermediate,
  })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  targetLevel?: DifficultyLevel;

  @ApiPropertyOptional({
    description: 'Focus areas to prioritize',
    type: [String],
    example: ['vocabulary', 'grammar'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusAreas?: string[];

  @ApiPropertyOptional({
    description: 'Timeframe in days to complete the learning path',
    example: 90,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeframe?: number;
}





