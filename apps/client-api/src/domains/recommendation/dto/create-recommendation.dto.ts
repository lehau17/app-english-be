import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max, IsObject } from 'class-validator';

export class CreateRecommendationDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Recommendation type (course, lesson, activity, podcast)' })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Recommendation title' })
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Recommendation description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Confidence score (0-1)', minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @ApiProperty({ description: 'Reasoning for recommendation', required: false })
  @IsOptional()
  @IsString()
  reasoning?: string;

  @ApiProperty({ description: 'Target data (courseId, lessonId, etc.)', required: false })
  @IsOptional()
  @IsObject()
  targetData?: Record<string, any>;

  @ApiProperty({ description: 'Expiration date', required: false })
  @IsOptional()
  expiresAt?: Date;
}







