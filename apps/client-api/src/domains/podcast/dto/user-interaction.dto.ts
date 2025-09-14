import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateProgressDto {
  @ApiProperty({ description: 'Current position in seconds' })
  @IsNumber()
  @Min(0)
  currentPosition: number;

  @ApiPropertyOptional({ description: 'Total time listened in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalListened?: number;

  @ApiPropertyOptional({ description: 'Session study time in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionStudyTime?: number;
}

export class ToggleLikeDto {
  @ApiProperty({ description: 'Like status' })
  @IsBoolean()
  isLiked: boolean;
}

export class ToggleSaveDto {
  @ApiProperty({ description: 'Save status' })
  @IsBoolean()
  isSaved: boolean;
}

export class CreateRatingDto {
  @ApiProperty({ description: 'Overall rating (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  overallRating: number;

  @ApiProperty({ description: 'Difficulty rating (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  difficultyRating: number;

  @ApiProperty({ description: 'Quality rating (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  qualityRating: number;

  @ApiPropertyOptional({ description: 'Content rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  contentRating?: number;

  @ApiPropertyOptional({ description: 'Audio quality rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  audioRating?: number;

  @ApiPropertyOptional({ description: 'Review title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Review comment' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ type: [String], description: 'Positive aspects' })
  @IsOptional()
  pros?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Negative aspects' })
  @IsOptional()
  cons?: string[];
}

export class GetRatingsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Sort by field', default: 'newest' })
  @IsOptional()
  @IsString()
  sortBy?: 'newest' | 'oldest' | 'rating' | 'helpful' = 'newest';
}

export class CreatePlaylistDto {
  @ApiProperty({ description: 'Playlist name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Playlist description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Is playlist public', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean = false;

  @ApiPropertyOptional({ description: 'Thumbnail URL' })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ type: [String], description: 'Tags' })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class AddToPlaylistDto {
  @ApiProperty({ description: 'Podcast ID' })
  @IsString()
  podcastId: string;

  @ApiPropertyOptional({ description: 'Order in playlist' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  orderNo?: number;
}

export class GetUserProgressQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: 'in_progress' | 'completed' | 'liked' | 'saved';

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
