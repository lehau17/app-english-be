import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBase64,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class EvaluateBaseDto {
  @ApiPropertyOptional({
    description: 'Activity ID (optional, only required if saving to Activity attempts)',
    example: '2b7f1c87-d8aa-4ec7-a323-63d811f5c001',
  })
  @IsOptional()
  @IsUUID()
  activityId?: string;
}

export class EvaluateSpeechDto extends EvaluateBaseDto {
  @ApiProperty({
    description: 'Recorded audio in base64 (without data URI prefix)',
  })
  @IsString()
  @IsNotEmpty()
  @IsBase64()
  audioBase64!: string;

  @ApiPropertyOptional({
    description: 'MIME type of audio recording',
    example: 'audio/webm',
  })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Original speaking prompt/context provided to the learner',
  })
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional({
    description: 'Minimum speaking duration in seconds used as reference',
    example: 45,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSeconds?: number;
}

export class EvaluatePronunciationDto extends EvaluateSpeechDto {
  @ApiProperty({ description: 'Target phrase the learner should pronounce' })
  @IsString()
  phrase!: string;
}

export class EvaluateWritingDto extends EvaluateBaseDto {
  @ApiProperty({ description: 'Learner writing submission' })
  @IsString()
  submission!: string;

  @ApiPropertyOptional({ description: 'Writing prompt shown to the learner' })
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional({
    description: 'Minimum expected words for the writing task',
    example: 80,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minWords?: number;
}

export class EvaluationCategoryDto {
  @ApiProperty({ description: 'Category name', example: 'Fluency' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Comment for the category' })
  @IsString()
  comment!: string;
}

export class EvaluationResultDto {
  @ApiProperty({ description: 'Attempt identifier stored by the system' })
  @IsUUID()
  attemptId!: string;

  @ApiProperty({ description: 'AI score between 0 and 100' })
  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @ApiProperty({ description: 'Overall AI feedback' })
  @IsString()
  feedback!: string;

  @ApiPropertyOptional({
    type: [EvaluationCategoryDto],
    description: 'Optional detailed comments per criterion',
  })
  @IsOptional()
  categories?: EvaluationCategoryDto[];

  @ApiPropertyOptional({
    description: 'Transcribed learner speech if available',
  })
  @IsOptional()
  transcript?: string;

  @ApiPropertyOptional({
    description: 'Additional structured insights',
    type: Object,
  })
  @IsOptional()
  detail?: Record<string, any> | null;
}
