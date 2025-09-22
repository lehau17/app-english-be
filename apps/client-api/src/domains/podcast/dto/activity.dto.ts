import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ListeningActivityType } from '../entities/podcast-activity.entity';

class FillBlankQuestionDto {
  @ApiProperty({ description: 'Question ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Sentence with blank' })
  @IsString()
  sentence: string;

  @ApiProperty({ description: 'Correct answer options', type: [String] })
  @IsArray()
  @IsString({ each: true })
  correctAnswers: string[];
}

class FillBlankContentDto {
  @ApiProperty({ description: 'Activity type', enum: ['fill_blank'] })
  @IsString()
  type: 'fill_blank';

  @ApiProperty({ description: 'Total number of questions' })
  @IsNumber()
  @Min(1)
  totalQuestions: number;

  @ApiProperty({
    description: 'Fill blank questions',
    type: [FillBlankQuestionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FillBlankQuestionDto)
  questions: FillBlankQuestionDto[];
}

export class CreateActivityDto {
  @ApiProperty({ description: 'Podcast ID' })
  @IsString()
  podcastId: string;

  @ApiProperty({ enum: ListeningActivityType })
  @IsEnum(ListeningActivityType)
  type: ListeningActivityType;

  @ApiProperty({ description: 'Activity title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Activity description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Order in podcast' })
  @IsNumber()
  @Min(1)
  orderNo: number;

  @ApiPropertyOptional({ description: 'Time limit in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  timeLimit?: number;

  @ApiPropertyOptional({ description: 'Points awarded', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  points?: number = 10;

  @ApiProperty({ description: 'Fill blank activity content' })
  @IsObject()
  @ValidateNested()
  @Type(() => FillBlankContentDto)
  content: FillBlankContentDto;
}

export class UpdateActivityDto {
  @ApiPropertyOptional({ description: 'Activity title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Activity description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Order in podcast' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  orderNo?: number;

  @ApiPropertyOptional({ description: 'Time limit in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  timeLimit?: number;

  @ApiPropertyOptional({ description: 'Points awarded' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  points?: number;

  @ApiPropertyOptional({ description: 'Fill blank activity content' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FillBlankContentDto)
  content?: FillBlankContentDto;

  @ApiPropertyOptional({ description: 'Is activity active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SubmitAttemptDto {
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

export class GetActivitiesQueryDto {
  @ApiPropertyOptional({
    description: 'Show only active activities',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean = true;
}

export class GetAttemptsQueryDto extends RequestPagingDto {
  // Inherits: page, limit, search, sortBy, sortOrder from RequestPagingDto
  // sortBy can be used for 'newest', 'oldest', 'score' sorting
}
