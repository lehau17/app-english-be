import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export enum ActivityType {
  VOCAB = 'vocab',
  PRONUNCIATION = 'pronunciation',
  LISTENING = 'listening',
  SPEAKING = 'speaking',
  MINI_GAME = 'mini_game',
  FILL_BLANK = 'fill_blank',
  DICTATION = 'dictation',
  MATCHING = 'matching',
  READING = 'reading',
  WRITING = 'writing',
  GRAMMAR = 'grammar',
  QUIZ = 'quiz',
  FLASHCARD = 'flashcard',
  CONVERSATION = 'conversation',
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  ELEMENTARY = 'elementary',
  INTERMEDIATE = 'intermediate',
  UPPER_INTERMEDIATE = 'upper_intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export class GenerateActivitiesDto {
  @ApiProperty({
    description: 'Course title for context',
    example: 'Complete English Course',
  })
  @IsString()
  @IsNotEmpty()
  courseTitle: string;

  @ApiPropertyOptional({
    description: 'Course description for context',
    example: 'Comprehensive English learning from beginner to advanced',
  })
  @IsString()
  @IsOptional()
  courseDescription?: string;

  @ApiProperty({
    description: 'Lesson title',
    example: 'Introduction to English',
  })
  @IsString()
  @IsNotEmpty()
  lessonTitle: string;

  @ApiPropertyOptional({
    description: 'Lesson description',
    example: 'Basic greetings and introductions',
  })
  @IsString()
  @IsOptional()
  lessonDescription?: string;

  @ApiPropertyOptional({
    description: 'Detailed user prompt describing what content to generate',
    example: 'Focus on formal greetings used in business settings, include common phrases for meeting new people',
  })
  @IsString()
  @IsOptional()
  userPrompt?: string;

  @ApiProperty({
    description: 'Number of activities to generate',
    example: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsInt()
  @Min(1)
  @Max(10)
  count: number;

  @ApiPropertyOptional({
    description: 'Types of activities to generate',
    example: ['vocab', 'quiz', 'listening'],
    isArray: true,
    enum: ActivityType,
  })
  @IsArray()
  @IsEnum(ActivityType, { each: true })
  @IsOptional()
  activityTypes?: ActivityType[];

  @ApiPropertyOptional({
    description: 'Difficulty level',
    example: 'beginner',
    enum: DifficultyLevel,
  })
  @IsEnum(DifficultyLevel)
  @IsOptional()
  difficulty?: DifficultyLevel;
}
