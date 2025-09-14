import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min
} from 'class-validator';

export class SubmitAttemptDto {
  @ApiProperty({ description: 'User answers (JSON format)' })
  answers: any;

  @ApiPropertyOptional({ description: 'Time taken in seconds', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeTaken?: number;

  @ApiPropertyOptional({ description: 'Additional data (JSON format)' })
  @IsOptional()
  additionalData?: any;
}

export class GetAttemptsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['newest', 'oldest', 'score'],
    default: 'newest'
  })
  @IsOptional()
  @IsEnum(['newest', 'oldest', 'score'])
  sortBy?: 'newest' | 'oldest' | 'score' = 'newest';
}
