import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaderboardScope } from '@prisma/client';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ClassroomLeaderboardQueryDto {
  @ApiPropertyOptional({
    description: 'ISO date string marking the start of the range (inclusive).',
    example: '2024-05-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'ISO date string marking the end of the range (exclusive).',
    example: '2024-06-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    description: 'Calendar year used for snapshot bucketing.',
    example: 2024,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number;

  @ApiPropertyOptional({
    description: 'Calendar month (1-12) used for snapshot bucketing.',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

export class MonthlyLeaderboardQueryDto {
  @ApiProperty({ description: 'Calendar year to aggregate.', example: 2024 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year!: number;

  @ApiProperty({
    description: 'Calendar month (1-12) to aggregate.',
    example: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiPropertyOptional({
    description: 'Optional classroom filter.',
    example: 'c20bb648-f4f1-4aa1-a8a1-fdd2c27215b7',
  })
  @IsOptional()
  @IsUUID()
  classroomId?: string;
}

export class YearlyLeaderboardQueryDto {
  @ApiProperty({ description: 'Calendar year to aggregate.', example: 2024 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year!: number;

  @ApiPropertyOptional({
    description: 'Optional classroom filter.',
    example: 'c20bb648-f4f1-4aa1-a8a1-fdd2c27215b7',
  })
  @IsOptional()
  @IsUUID()
  classroomId?: string;
}

export class LeaderboardEntryDto {
  @ApiProperty({ description: 'Student identifier.' })
  userId!: string;

  @ApiProperty({ description: 'Display name resolved for the student.' })
  displayName!: string;

  @ApiPropertyOptional({
    description: 'Avatar URL if available.',
    nullable: true,
  })
  avatarUrl?: string | null;

  @ApiProperty({
    description: 'Sum of scores within the selected range.',
    example: 450,
  })
  totalScore!: number;

  @ApiProperty({ description: 'Leaderboard rank (1 = top).', example: 1 })
  rank!: number;

  @ApiPropertyOptional({ description: 'Additional metadata for the entry.' })
  metadata?: Record<string, unknown>;
}

export class LeaderboardResponseDto {
  @ApiProperty({ enum: LeaderboardScope })
  scope!: LeaderboardScope;

  @ApiPropertyOptional({ description: 'Classroom identifier when applicable.' })
  classroomId?: string;

  @ApiPropertyOptional({
    description: 'Calendar year associated with the snapshot.',
  })
  year?: number;

  @ApiPropertyOptional({
    description: 'Calendar month associated with the snapshot.',
  })
  month?: number | null;

  @ApiPropertyOptional({
    description: 'Range start (ISO string) used for aggregation.',
  })
  from?: string;

  @ApiPropertyOptional({
    description: 'Range end (ISO string) used for aggregation.',
  })
  to?: string;

  @ApiProperty({ type: [LeaderboardEntryDto] })
  entries!: LeaderboardEntryDto[];
}
