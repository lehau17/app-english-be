import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
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

  @ApiPropertyOptional({
    description: 'Whether playlist is public',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Playlist thumbnail URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'Playlist tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Playlist category' })
  @IsOptional()
  @IsString()
  category?: string;
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

  @ApiPropertyOptional({ description: 'Playlist thumbnail URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'Playlist tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Playlist category' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class GetPlaylistsQueryDto extends RequestPagingDto {
  // Inherits: page, limit, search, sortBy, sortOrder from RequestPagingDto
  // sortBy can be used for 'newest', 'name' sorting

  @ApiPropertyOptional({
    description: 'Privacy filter',
    enum: ['public', 'private'],
  })
  @IsOptional()
  @IsIn(['public', 'private'])
  privacy?: 'public' | 'private';
}
