import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

// ===================== USER PROGRESS =====================

export class UpdateProgressDto {
  @ApiProperty({ description: 'Current position in seconds' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentPosition: number;

  @ApiPropertyOptional({ description: 'Total time listened this session (seconds)' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalListened?: number;

  @ApiPropertyOptional({ description: 'Study time for this session (seconds)' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionStudyTime?: number;
}

// ===================== LIKE/SAVE =====================

export class ToggleLikeDto {
  @ApiProperty({ description: 'Whether to like or unlike' })
  @IsBoolean()
  isLiked: boolean;
}

export class ToggleSaveDto {
  @ApiProperty({ description: 'Whether to save or unsave' })
  @IsBoolean()
  isSaved: boolean;
}

// ===================== RATINGS =====================

export class CreateRatingDto {
  @ApiProperty({ description: 'Overall rating', minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  overallRating: number;

  @ApiPropertyOptional({ description: 'Difficulty rating', minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  difficultyRating?: number;

  @ApiPropertyOptional({ description: 'Audio quality rating', minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  qualityRating?: number;

  @ApiPropertyOptional({ description: 'Written review' })
  @IsOptional()
  @IsString()
  review?: string;

  @ApiPropertyOptional({ description: 'Rating title' })
  @IsOptional()
  @IsString()
  title?: string;
}

export class GetRatingsQueryDto extends RequestPagingDto {
  // Uses inherited page, limit, sortBy, sortOrder, search from RequestPagingDto
  // sortBy can be: 'newest', 'oldest', 'rating', 'helpful'
}
