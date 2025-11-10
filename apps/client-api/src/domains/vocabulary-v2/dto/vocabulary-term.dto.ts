import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DifficultyLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ExampleSentenceDto {
  @ApiProperty({
    description: 'Example sentence',
    example: 'The destination was breathtaking.',
  })
  @IsString()
  sentence: string;

  @ApiPropertyOptional({
    description: 'Vietnamese translation',
    example: 'Điểm đến thật ngoạn mục.',
  })
  @IsOptional()
  @IsString()
  translation?: string;
}

export class CreateVocabularyTermDto {
  @ApiProperty({
    description: 'Word or phrase',
    example: 'destination',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  word: string;

  @ApiProperty({
    description: 'Definition',
    example: 'A place to which someone or something is going or being sent',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  definition: string;

  @ApiPropertyOptional({
    description: 'Pronunciation guide',
    example: '/ˌdestɪˈneɪʃən/',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pronunciation?: string;

  @ApiPropertyOptional({
    description: 'Part of speech',
    example: 'noun',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  partOfSpeech?: string;

  @ApiPropertyOptional({
    description: 'Audio URL',
    example: 'https://example.com/audio/destination.mp3',
  })
  @IsOptional()
  @IsUrl()
  audioUrl?: string;

  @ApiPropertyOptional({
    description: 'Image URL',
    example: 'https://example.com/images/destination.jpg',
  })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Example sentences',
    type: [ExampleSentenceDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleSentenceDto)
  examples?: ExampleSentenceDto[];

  @ApiPropertyOptional({
    description: 'Synonyms',
    example: ['place', 'location', 'spot'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];

  @ApiPropertyOptional({
    description: 'Antonyms',
    example: ['origin', 'source'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  antonyms?: string[];

  @ApiPropertyOptional({
    description: 'IPA US pronunciation',
    example: '/ˌdestəˈneɪʃən/',
  })
  @IsOptional()
  @IsString()
  ipaUs?: string;

  @ApiPropertyOptional({
    description: 'IPA UK pronunciation',
    example: '/ˌdestɪˈneɪʃən/',
  })
  @IsOptional()
  @IsString()
  ipaUk?: string;

  @ApiPropertyOptional({
    description: 'Vietnamese translation',
    example: 'điểm đến, nơi đến',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  translationVi?: string;

  @ApiPropertyOptional({
    description: 'Order index in unit',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({
    description: 'Difficulty level',
    enum: DifficultyLevel,
    default: 'beginner',
  })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;
}

export class UpdateVocabularyTermDto {
  @ApiPropertyOptional({ description: 'Word' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  word?: string;

  @ApiPropertyOptional({ description: 'Definition' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  definition?: string;

  @ApiPropertyOptional({ description: 'Pronunciation' })
  @IsOptional()
  @IsString()
  pronunciation?: string;

  @ApiPropertyOptional({ description: 'Part of speech' })
  @IsOptional()
  @IsString()
  partOfSpeech?: string;

  @ApiPropertyOptional({ description: 'Audio URL' })
  @IsOptional()
  @IsUrl()
  audioUrl?: string;

  @ApiPropertyOptional({ description: 'Image URL' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ type: [ExampleSentenceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleSentenceDto)
  examples?: ExampleSentenceDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  antonyms?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipaUs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipaUk?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  translationVi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({ enum: DifficultyLevel })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;
}

export class UserProgressDto {
  @ApiProperty({
    description: 'Progress status',
    enum: ['new', 'learning', 'review', 'mastered'],
  })
  status: string;

  @ApiProperty()
  nextReviewAt: Date;

  @ApiProperty()
  correctCount: number;

  @ApiProperty()
  wrongCount: number;

  @ApiProperty()
  repetitions: number;

  @ApiPropertyOptional()
  lastReviewAt?: Date;
}

export class VocabularyTermResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  unitId: string;

  @ApiProperty()
  word: string;

  @ApiProperty()
  definition: string;

  @ApiPropertyOptional()
  pronunciation?: string;

  @ApiPropertyOptional()
  partOfSpeech?: string;

  @ApiPropertyOptional()
  audioUrl?: string;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiPropertyOptional()
  examples?: any; // JSON

  @ApiPropertyOptional({ type: [String] })
  synonyms?: string[];

  @ApiPropertyOptional({ type: [String] })
  antonyms?: string[];

  @ApiPropertyOptional()
  ipaUs?: string;

  @ApiPropertyOptional()
  ipaUk?: string;

  @ApiPropertyOptional()
  translationVi?: string;

  @ApiProperty()
  orderIndex: number;

  @ApiProperty({ enum: DifficultyLevel })
  difficulty: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // User progress (if authenticated)
  @ApiPropertyOptional({ type: UserProgressDto })
  userProgress?: UserProgressDto;
}

export class ImportTermsDto {
  @ApiProperty({
    description: 'Array of terms to import',
    type: [CreateVocabularyTermDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVocabularyTermDto)
  terms: CreateVocabularyTermDto[];
}

export class ReorderTermsDto {
  @ApiProperty({
    description: 'Ordered array of term IDs',
    example: ['term-id-1', 'term-id-2', 'term-id-3'],
    type: [String],
  })
  @IsString({ each: true })
  termIds: string[];
}
