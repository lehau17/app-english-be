import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentType, DifficultyLevel } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import * as uuid from 'uuid';
import { ACTIVITY_TYPES, ActivityTypeValue } from '../../course/dto';

// Custom validator for content based on activity type
@ValidatorConstraint({ name: 'ValidateActivityContent', async: false })
export class ActivityContentValidator implements ValidatorConstraintInterface {
  validate(content: any, args: ValidationArguments) {
    const activity = args.object as AssignmentActivityDto;
    const activityType = activity.type;

    if (!content || typeof content !== 'object') {
      return false;
    }

    // Basic validation based on activity type
    switch (activityType) {
      case 'quiz':
      case 'grammar':
        // Support both single question format and multiple questions format
        if (Array.isArray(content.questions) && content.questions.length > 0) {
          // Multiple questions format (from AI generation)
          return content.questions.every(
            (q: any) =>
              typeof q.question === 'string' &&
              Array.isArray(q.options) &&
              q.options.length > 0 &&
              typeof q.correctIndex === 'number' &&
              q.correctIndex >= 0 &&
              q.correctIndex < q.options.length,
          );
        }
        // Single question format (legacy)
        return (
          typeof content.question === 'string' &&
          Array.isArray(content.options) &&
          content.options.length > 0 &&
          typeof content.correctIndex === 'number' &&
          content.correctIndex >= 0 &&
          content.correctIndex < content.options.length
        );
      case 'reading':
        // Reading with multiple questions format: { passage?, questions: [...] }
        return (
          Array.isArray(content.questions) &&
          content.questions.length > 0 &&
          content.questions.every(
            (q: any) =>
              typeof q.question === 'string' &&
              Array.isArray(q.options) &&
              q.options.length > 0 &&
              typeof q.correctIndex === 'number' &&
              q.correctIndex >= 0 &&
              q.correctIndex < q.options.length,
          )
        );
      case 'listening':
        // Listening format: { audioUrl, questions: [...] }
        return (
          typeof content.audioUrl === 'string' &&
          Array.isArray(content.questions) &&
          content.questions.length > 0 &&
          content.questions.every(
            (q: any) =>
              typeof q.question === 'string' &&
              Array.isArray(q.options) &&
              q.options.length > 0 &&
              typeof q.correctIndex === 'number' &&
              q.correctIndex >= 0 &&
              q.correctIndex < q.options.length,
          )
        );
      case 'pronunciation':
        // Pronunciation format: { phrases: [{ text, sampleUrl? }] }
        return (
          Array.isArray(content.phrases) &&
          content.phrases.length > 0 &&
          content.phrases.every(
            (p: any) => typeof p.text === 'string' && p.text.length > 0,
          )
        );
      case 'vocab':
        return Array.isArray(content.items) && content.items.length > 0;
      case 'flashcard':
        return Array.isArray(content.cards) && content.cards.length > 0;
      default:
        return true; // For other types, just allow any object
    }
  }

  defaultMessage(args: ValidationArguments) {
    const activity = args.object as AssignmentActivityDto;
    return `Content is invalid for activity type '${activity.type}'`;
  }
}

export class AssignmentActivityDto {
  @ApiProperty({
    description: 'Internal assignment activity ID',
    example: 'activity-1',
  })
  @IsString()
  @IsOptional()
  id: string = uuid.v4();

  @ApiProperty({ enum: ACTIVITY_TYPES, description: 'Activity type' })
  @IsEnum(ACTIVITY_TYPES)
  type!: ActivityTypeValue;

  @ApiProperty({ description: 'Activity title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Activity instructions' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiProperty({
    description: 'Activity content (structured based on activity type)',
  })
  @IsObject()
  @Validate(ActivityContentValidator)
  content!: any;

  @ApiPropertyOptional({
    description: 'XP/Points for this activity',
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  points?: number;

  @ApiPropertyOptional({ description: 'Passing score (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  passingScore?: number;

  @ApiPropertyOptional({
    enum: DifficultyLevel,
    description: 'Difficulty level',
  })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ type: [String], description: 'Hints (plain text)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hints?: string[];

  @ApiPropertyOptional({
    description: 'Media URLs (audio, video, images)',
    example: { audio: 'https://example.com/audio.mp3' },
  })
  @IsOptional()
  @IsObject()
  mediaUrls?: any;
}

export class CreateAssignmentDto {
  @ApiProperty({ description: 'Assignment title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    enum: AssignmentType,
    description: 'Type of the assignment',
  })
  @IsEnum(AssignmentType)
  @IsOptional()
  type?: AssignmentType = AssignmentType.HOMEWORK;

  @ApiPropertyOptional({
    description:
      'Weight of the assignment in the final grade (e.g., 0.4 for 40%)',
    minimum: 0,
    maximum: 1,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  weight?: number = 0;

  @ApiPropertyOptional({ description: 'Assignment description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Assignment instructions' })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional({
    description: 'Due date for assignment',
    example: '2024-12-31T17:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Total points possible',
    minimum: 1,
    default: 100,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'number' ? value : parseInt(value),
  )
  totalPoints?: number = 100;

  @ApiPropertyOptional({
    description: 'Time limit in minutes',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'number' ? value : parseInt(value),
  )
  timeLimit?: number;

  @ApiPropertyOptional({
    description: 'Maximum attempts allowed',
    minimum: 1,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'number' ? value : parseInt(value),
  )
  maxAttempts?: number = 1;

  @ApiPropertyOptional({
    description: 'Publish assignment immediately',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isPublished?: boolean = false;

  @ApiPropertyOptional({
    description: 'Assign to specific students (user IDs)',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assignedTo?: string[] = [];

  @ApiProperty({
    description: 'Activities in this assignment',
    type: [AssignmentActivityDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentActivityDto)
  activities!: AssignmentActivityDto[];

  @ApiPropertyOptional({ description: 'Custom content as JSON' })
  @IsObject()
  @IsOptional()
  customContent?: any;
}
