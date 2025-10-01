import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AttemptResultDto {
  @ApiProperty({ description: 'Attempt ID' })
  @IsString()
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Activity ID' })
  @IsString()
  @IsUUID()
  activityId: string;

  @ApiProperty({ description: 'Attempt number' })
  @IsNumber()
  @Min(1)
  attemptNo: number;

  @ApiProperty({ description: 'Number of correct answers' })
  @IsNumber()
  @Min(0)
  correctCount: number;

  @ApiProperty({ description: 'Total number of questions' })
  @IsNumber()
  @Min(1)
  totalQuestions: number;

  @ApiProperty({ description: 'Score as percentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  scorePercent: number;

  @ApiPropertyOptional({ description: 'Time spent in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpent?: number;

  @ApiProperty({
    description: 'User answers for each question',
    type: 'object',
  })
  @IsObject()
  answers: Record<string, string>; // questionId -> userAnswer

  @ApiProperty({ description: 'Attempt creation date' })
  createdAt: Date;
}

export class CreateAttemptResultDto {
  @ApiProperty({ description: 'Number of correct answers' })
  @IsNumber()
  @Min(0)
  correctCount: number;

  @ApiProperty({ description: 'Total number of questions' })
  @IsNumber()
  @Min(1)
  totalQuestions: number;

  @ApiProperty({
    description: 'User answers for each question',
    type: 'object',
  })
  @IsObject()
  answers: Record<string, string>; // questionId -> userAnswer

  @ApiPropertyOptional({ description: 'Time spent in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpent?: number;
}
