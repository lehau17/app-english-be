import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Blocking status response
 */
export class BlockingStatusDto {
  @ApiProperty({ description: 'Whether student is currently blocked' })
  isBlocked: boolean;

  @ApiPropertyOptional({ description: 'Date when student was blocked' })
  blockedAt?: Date;

  @ApiPropertyOptional({ description: 'Reason for blocking' })
  blockedReason?: string;

  @ApiProperty({ description: 'Current consecutive absences count' })
  consecutiveAbsences: number;

  @ApiProperty({ description: 'Threshold for blocking' })
  threshold: number;

  @ApiPropertyOptional({ description: 'Date of last absence' })
  lastAbsenceDate?: Date;
}

/**
 * Update blocking configuration DTO
 */
export class UpdateBlockingConfigDto {
  @ApiPropertyOptional({
    description: 'Enable/disable blocking for this classroom',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Consecutive absences threshold (1-10)',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  threshold?: number;
}

/**
 * Unblock student DTO
 */
export class UnblockStudentDto {
  @ApiProperty({ description: 'Reason for unblocking (required)' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Block student DTO (manual blocking)
 */
export class BlockStudentDto {
  @ApiProperty({ description: 'Reason for blocking' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
