import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, IsEnum, IsInt, Min } from 'class-validator';
import { MediaFile } from '@prisma/client';

export class MediaFileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  filename: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  size: number;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional()
  thumbnail?: string;

  @ApiProperty()
  isProcessed: boolean;

  @ApiPropertyOptional()
  duration?: number;

  @ApiProperty()
  usageCount: number;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[];

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  source?: string;

  @ApiPropertyOptional()
  sourceId?: string;

  @ApiPropertyOptional()
  context?: any;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(mediaFile: MediaFile): MediaFileResponseDto {
    return {
      id: mediaFile.id,
      filename: mediaFile.filename,
      originalName: mediaFile.originalName,
      mimeType: mediaFile.mimeType,
      size: mediaFile.size,
      url: mediaFile.url,
      thumbnail: mediaFile.thumbnail || undefined,
      isProcessed: mediaFile.isProcessed,
      duration: mediaFile.duration || undefined,
      usageCount: mediaFile.usageCount,
      tags: mediaFile.tags || [],
      description: mediaFile.description || undefined,
      category: mediaFile.category || undefined,
      source: mediaFile.source || undefined,
      sourceId: mediaFile.sourceId || undefined,
      context: mediaFile.context || undefined,
      createdAt: mediaFile.createdAt,
      updatedAt: mediaFile.updatedAt,
    };
  }
}

export class MediaFileQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class MediaSearchQueryDto {
  @ApiProperty()
  @IsString()
  q: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
