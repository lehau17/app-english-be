import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    Min
} from 'class-validator';
import { PodcastCategory, PodcastDifficulty, PodcastSource, PodcastStatus } from '../entities/podcast.entity';

export class GetPodcastsQueryDto extends RequestPagingDto {
  @ApiPropertyOptional({ enum: PodcastCategory, description: 'Filter by category' })
  @IsOptional()
  @IsEnum(PodcastCategory)
  category?: PodcastCategory;

  @ApiPropertyOptional({ enum: PodcastSource, description: 'Filter by source' })
  @IsOptional()
  @IsEnum(PodcastSource)
  source?: PodcastSource;

  @ApiPropertyOptional({ enum: PodcastDifficulty, description: 'Filter by difficulty' })
  @IsOptional()
  @IsEnum(PodcastDifficulty)
  difficulty?: PodcastDifficulty;

  @ApiPropertyOptional({ description: 'Filter by duration range (short|medium|long)' })
  @IsOptional()
  @IsString()
  duration?: 'short' | 'medium' | 'long';

  @ApiPropertyOptional({ description: 'Show only recommended podcasts' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  recommended?: boolean;

  @ApiPropertyOptional({ description: 'Show only podcasts with activities' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasActivities?: boolean;

  @ApiPropertyOptional({ description: 'Show only premium content' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  premium?: boolean;

  @ApiPropertyOptional({ description: 'Filter by user tab', enum: ['all', 'recommended', 'listening', 'completed'] })
  @IsOptional()
  @IsString()
  tab?: 'all' | 'recommended' | 'listening' | 'completed';
}

export class CreatePodcastDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storyTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storyContent?: string;

  @ApiProperty()
  @IsUrl()
  audioUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  transcriptUrl?: string;

  @ApiProperty({ enum: PodcastCategory })
  @IsEnum(PodcastCategory)
  category: PodcastCategory;

  @ApiProperty({ enum: PodcastSource })
  @IsEnum(PodcastSource)
  source: PodcastSource;

  @ApiProperty({ enum: PodcastDifficulty, default: PodcastDifficulty.INTERMEDIATE })
  @IsOptional()
  @IsEnum(PodcastDifficulty)
  difficulty?: PodcastDifficulty = PodcastDifficulty.INTERMEDIATE;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] = [];

  @ApiProperty()
  @IsNumber()
  @Min(1)
  duration: number; // seconds

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  durationFormatted?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[] = [];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hasTranscript?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hasActivities?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRecommended?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean = false;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorName?: string;
}

export class UpdatePodcastDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storyTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storyContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  audioUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  transcriptUrl?: string;

  @ApiPropertyOptional({ enum: PodcastCategory })
  @IsOptional()
  @IsEnum(PodcastCategory)
  category?: PodcastCategory;

  @ApiPropertyOptional({ enum: PodcastSource })
  @IsOptional()
  @IsEnum(PodcastSource)
  source?: PodcastSource;

  @ApiPropertyOptional({ enum: PodcastDifficulty })
  @IsOptional()
  @IsEnum(PodcastDifficulty)
  difficulty?: PodcastDifficulty;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  durationFormatted?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasTranscript?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasActivities?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecommended?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorName?: string;

  @ApiPropertyOptional({ enum: PodcastStatus })
  @IsOptional()
  @IsEnum(PodcastStatus)
  status?: PodcastStatus;
}

export class PodcastResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  data: any;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
