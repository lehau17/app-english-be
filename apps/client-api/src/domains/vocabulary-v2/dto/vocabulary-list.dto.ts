import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DifficultyLevel, LanguageCode } from '@prisma/client';
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUrl,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

export class CreateVocabularyListDto {
    @ApiProperty({ description: 'List title', example: 'IELTS Vocabulary' })
    @IsString()
    @MinLength(3)
    @MaxLength(200)
    title: string;

    @ApiPropertyOptional({
        description: 'List description',
        example: 'Essential vocabulary for IELTS Band 6.0-7.0',
    })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiProperty({
        description: 'Difficulty level',
        enum: DifficultyLevel,
        example: 'intermediate',
    })
    @IsEnum(DifficultyLevel)
    difficulty: DifficultyLevel;

    @ApiPropertyOptional({
        description: 'Category',
        example: 'IELTS',
    })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    category?: string;

    @ApiPropertyOptional({
        description: 'CEFR level',
        example: 'B2',
    })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    level?: string;

    @ApiPropertyOptional({
        description: 'Thumbnail image URL',
        example: 'https://example.com/ielts-thumbnail.jpg',
    })
    @IsOptional()
    @IsUrl()
    thumbnailUrl?: string;

    @ApiPropertyOptional({
        description: 'Banner image URL',
        example: 'https://example.com/ielts-banner.jpg',
    })
    @IsOptional()
    @IsUrl()
    bannerUrl?: string;

    @ApiPropertyOptional({
        description: 'Is the list public?',
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;

    @ApiPropertyOptional({
        description: 'Language',
        enum: LanguageCode,
        default: 'en',
    })
    @IsOptional()
    @IsEnum(LanguageCode)
    language?: LanguageCode;
}

export class UpdateVocabularyListDto {
    @ApiPropertyOptional({ description: 'List title' })
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(200)
    title?: string;

    @ApiPropertyOptional({ description: 'List description' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiPropertyOptional({
        description: 'Difficulty level',
        enum: DifficultyLevel,
    })
    @IsOptional()
    @IsEnum(DifficultyLevel)
    difficulty?: DifficultyLevel;

    @ApiPropertyOptional({ description: 'Category' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    category?: string;

    @ApiPropertyOptional({ description: 'CEFR level' })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    level?: string;

    @ApiPropertyOptional({ description: 'Thumbnail URL' })
    @IsOptional()
    @IsUrl()
    thumbnailUrl?: string;

    @ApiPropertyOptional({ description: 'Banner URL' })
    @IsOptional()
    @IsUrl()
    bannerUrl?: string;

    @ApiPropertyOptional({ description: 'Is public?' })
    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;
}

export class VocabularyListResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiPropertyOptional()
    description?: string;

    @ApiProperty({ enum: DifficultyLevel })
    difficulty: string;

    @ApiPropertyOptional()
    category?: string;

    @ApiPropertyOptional()
    level?: string;

    @ApiPropertyOptional()
    thumbnailUrl?: string;

    @ApiPropertyOptional()
    bannerUrl?: string;

    @ApiProperty()
    isPublic: boolean;

    @ApiProperty()
    isOfficial: boolean;

    @ApiProperty()
    totalTerms: number;

    @ApiProperty()
    totalUnits: number;

    @ApiProperty()
    userCount: number;

    @ApiProperty({ enum: LanguageCode })
    language: string;

    @ApiPropertyOptional()
    createdBy?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    // User progress (if authenticated)
    @ApiPropertyOptional({
        description: 'User progress data (only if user has added this list)',
    })
    userProgress?: {
        completedTerms: number;
        totalTerms: number;
        lastStudiedAt?: Date;
        addedAt: Date;
    };
}

export class GetVocabularyListsQueryDto {
    @ApiPropertyOptional({
        description: 'Filter by category',
        example: 'IELTS',
    })
    @IsOptional()
    @IsString()
    category?: string;

    @ApiPropertyOptional({
        description: 'Filter by difficulty',
        enum: DifficultyLevel,
    })
    @IsOptional()
    @IsEnum(DifficultyLevel)
    difficulty?: DifficultyLevel;

    @ApiPropertyOptional({
        description: 'Search query',
        example: 'business',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Show only official lists',
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    officialOnly?: boolean;

    @ApiPropertyOptional({
        description: 'Page number',
        minimum: 1,
        default: 1,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({
        description: 'Items per page',
        minimum: 1,
        maximum: 100,
        default: 20,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number;
}

export class PaginatedVocabularyListsResponseDto {
    @ApiProperty({ type: [VocabularyListResponseDto] })
    data: VocabularyListResponseDto[];

    @ApiProperty()
    total: number;

    @ApiProperty()
    page: number;

    @ApiProperty()
    limit: number;

    @ApiProperty()
    totalPages: number;
}


