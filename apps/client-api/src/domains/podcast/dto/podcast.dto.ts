import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PodcastCategory,
  PodcastDifficulty,
  PodcastSource,
  PodcastStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';

export class GetPodcastsQueryDto extends RequestPagingDto {
  @ApiPropertyOptional({
    enum: PodcastCategory,
    description: 'Filter by category',
  })
  @IsOptional()
  @IsEnum(PodcastCategory)
  category?: PodcastCategory;

  @ApiPropertyOptional({ enum: PodcastSource, description: 'Filter by source' })
  @IsOptional()
  @IsEnum(PodcastSource)
  source?: PodcastSource;

  @ApiPropertyOptional({
    enum: PodcastDifficulty,
    description: 'Filter by difficulty',
  })
  @IsOptional()
  @IsEnum(PodcastDifficulty)
  difficulty?: PodcastDifficulty;

  @ApiPropertyOptional({
    description: 'Filter by duration range (short|medium|long)',
  })
  @IsOptional()
  @IsString()
  duration?: 'short' | 'medium' | 'long';

  @ApiPropertyOptional({ description: 'Show only recommended podcasts' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  recommended?: boolean;

  @ApiPropertyOptional({ description: 'Show only premium content' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  premium?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by user tab',
    enum: ['all', 'recommended', 'listening', 'completed'],
  })
  @IsOptional()
  @IsString()
  tab?: 'all' | 'recommended' | 'listening' | 'completed';
}

export class CreatePodcastGapDto {
  @ApiProperty({ description: 'Vị trí ký tự bắt đầu trong transcript' })
  @IsInt()
  startIndex: number;

  @ApiProperty({ description: 'Vị trí ký tự kết thúc trong transcript' })
  @IsInt()
  endIndex: number;

  @ApiProperty({ description: 'Đáp án đúng' })
  @IsString()
  answer: string;

  @ApiPropertyOptional({ description: 'Thứ tự câu hỏi' })
  @IsOptional()
  @IsInt()
  orderNo?: number;
}

export class CreatePodcastDto {
  @ApiProperty({ description: 'Tiêu đề podcast' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Mô tả podcast' })
  @IsString()
  description: string;

  @ApiProperty({
    description:
      'Nội dung podcast - transcript cho upload hoặc text cho generate',
  })
  @IsString()
  content: string;

  @ApiProperty({ description: 'URL audio - từ upload hoặc generated' })
  @IsString()
  audioUrl: string;

  @ApiPropertyOptional({ description: 'URL thumbnail' })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiProperty({ enum: PodcastCategory, description: 'Danh mục' })
  @IsEnum(PodcastCategory)
  category: PodcastCategory;

  @ApiProperty({ enum: PodcastDifficulty, description: 'Độ khó' })
  @IsEnum(PodcastDifficulty)
  difficulty: PodcastDifficulty;

  @ApiProperty({ description: 'Chế độ audio', enum: ['upload', 'generate'] })
  @IsEnum(['upload', 'generate'])
  audioMode: 'upload' | 'generate';

  @ApiPropertyOptional({ description: 'Loại giọng đọc (cho generate mode)' })
  @IsOptional()
  @IsString()
  voiceType?: string;

  @ApiPropertyOptional({ description: 'Tốc độ đọc (cho generate mode)' })
  @IsOptional()
  @IsNumber()
  speechSpeed?: number;

  @ApiPropertyOptional({ description: 'Thời lượng audio (giây)' })
  @IsOptional()
  @IsInt()
  duration?: number;

  @ApiPropertyOptional({
    description:
      'Gaps cho fill-in-the-blank (tùy chọn, sẽ auto-generate từ content nếu có [word])',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePodcastGapDto)
  gaps: CreatePodcastGapDto[];
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
  @IsUrl()
  audioUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transcript?: string;

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
