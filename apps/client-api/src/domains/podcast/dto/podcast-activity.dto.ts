import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum PodcastActivityType {
  FILL_BLANK = 'fill_blank',
}

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
  @ApiProperty({ description: 'Activity title', minLength: 1 })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiPropertyOptional({ description: 'Activity description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Podcast ID' })
  @IsString()
  @IsUUID()
  podcastId: string;

  @ApiProperty({
    description: 'Activity type (only fill_blank supported)',
    enum: PodcastActivityType,
  })
  @IsEnum(PodcastActivityType)
  type: PodcastActivityType;

  @ApiProperty({ description: 'Fill blank activity content' })
  @IsObject()
  @ValidateNested()
  @Type(() => FillBlankContentDto)
  content: FillBlankContentDto;

  @ApiPropertyOptional({ description: 'Time limit in seconds', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeLimit?: number;

  @ApiPropertyOptional({
    description: 'Points awarded',
    minimum: 0,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number = 10;
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {
  @ApiPropertyOptional({ description: 'Activity status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}

export class GetActivitiesQueryDto extends RequestPagingDto {
  @ApiProperty({ description: 'Podcast ID to get activities for' })
  @IsString()
  @IsUUID()
  podcastId: string;

  @ApiPropertyOptional({ description: 'Show only active activities' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  activeOnly?: boolean = true;
}
