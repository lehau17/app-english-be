import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlaylistDto {
  @ApiProperty({ description: 'Playlist name', minLength: 1 })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ description: 'Playlist description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether playlist is public', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdatePlaylistDto {
  @ApiPropertyOptional({ description: 'Playlist name', minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ description: 'Playlist description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether playlist is public' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class GetPlaylistsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['newest', 'name'],
    default: 'newest'
  })
  @IsOptional()
  @IsEnum(['newest', 'name'])
  sortBy?: 'newest' | 'name' = 'newest';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc'
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Privacy filter',
    enum: ['public', 'private']
  })
  @IsOptional()
  @IsEnum(['public', 'private'])
  privacy?: 'public' | 'private';
}
