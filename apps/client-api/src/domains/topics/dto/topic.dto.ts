import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DifficultyLevel } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  IsNotEmpty,
} from 'class-validator';

export class CreateTopicDto {
  @ApiProperty({ example: 'My Daily Routine' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Talk about your daily activities and habits',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'daily_life' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ enum: DifficultyLevel, example: DifficultyLevel.beginner })
  @IsEnum(DifficultyLevel)
  difficulty: DifficultyLevel;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}

export class UpdateTopicDto {
  @ApiPropertyOptional({ example: 'My Daily Routine' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'Talk about your daily activities and habits',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'daily_life' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    enum: DifficultyLevel,
    example: DifficultyLevel.beginner,
  })
  @IsEnum(DifficultyLevel)
  @IsOptional()
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  usageCount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  trendScore?: number;
}

export class TopicFilterDto {
  @ApiPropertyOptional({ example: 'daily_life' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    enum: DifficultyLevel,
    example: DifficultyLevel.beginner,
  })
  @IsEnum(DifficultyLevel)
  @IsOptional()
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  trending?: boolean;
}

export class TopicResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiProperty({ enum: DifficultyLevel })
  difficulty: DifficultyLevel;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isFeatured: boolean;

  @ApiProperty()
  usageCount: number;

  @ApiProperty()
  trendScore: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  isTrending?: boolean;
}

export class TrackTopicUsageDto {
  @ApiProperty({ example: 'topic-uuid' })
  @IsString()
  @IsNotEmpty()
  topicId: string;
}
