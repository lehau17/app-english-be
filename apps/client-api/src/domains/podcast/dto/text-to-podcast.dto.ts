import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    Min,
    MinLength
} from 'class-validator';
import { PodcastCategory, PodcastDifficulty } from '../entities/podcast.entity';

export enum VoiceType {
  MALE_EN_US = 'male_en_us',
  FEMALE_EN_US = 'female_en_us',
  MALE_EN_UK = 'male_en_uk',
  FEMALE_EN_UK = 'female_en_uk',
  MALE_EN_AU = 'male_en_au',
  FEMALE_EN_AU = 'female_en_au',
}

export enum ActivityGenerationType {
  FILL_BLANK = 'fill_blank',
}

export class CreatePodcastFromTextDto {
  @ApiProperty({ description: 'Podcast title', minLength: 1 })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiPropertyOptional({ description: 'Podcast description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Text content to convert to audio. Use [word] to manually select words for fill-blank, e.g., "Today we will [learn] about [weather]". If no [word] is used, system will auto-select words.',
    minLength: 10,
    example: 'Today we will [learn] about the [weather]. The sun is shining [brightly].'
  })
  @IsString()
  @MinLength(10)
  textContent: string;

  @ApiProperty({
    description: 'Voice type for text-to-speech',
    enum: VoiceType,
    default: VoiceType.FEMALE_EN_US
  })
  @IsEnum(VoiceType)
  voiceType: VoiceType = VoiceType.FEMALE_EN_US;

  @ApiProperty({
    description: 'Speech speed (0.5 - 2.0)',
    minimum: 0.5,
    maximum: 2.0,
    default: 1.0
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  speechSpeed: number = 1.0;

  @ApiProperty({
    description: 'Podcast category',
    enum: PodcastCategory
  })
  @IsEnum(PodcastCategory)
  category: PodcastCategory;

  @ApiProperty({
    description: 'Difficulty level',
    enum: PodcastDifficulty
  })
  @IsEnum(PodcastDifficulty)
  difficulty: PodcastDifficulty;

  @ApiPropertyOptional({
    description: 'Tags for the podcast',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description: 'Number of fill-in-blank questions to generate',
    minimum: 1,
    maximum: 20,
    default: 5
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  numberOfBlanks: number = 5;

  @ApiProperty({
    description: 'Difficulty of generated questions (easy, medium, hard)',
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  })
  @IsEnum(['easy', 'medium', 'hard'])
  questionDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
}

export class GenerateActivitiesDto {
  @ApiProperty({ description: 'Podcast ID to generate activities for' })
  @IsString()
  podcastId: string;

  @ApiProperty({
    description: 'Number of fill-blank questions to generate',
    minimum: 1,
    maximum: 15,
    default: 5
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(15)
  numberOfQuestions: number = 5;

  @ApiProperty({
    description: 'Difficulty of generated questions',
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  })
  @IsEnum(['easy', 'medium', 'hard'])
  questionDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
}
