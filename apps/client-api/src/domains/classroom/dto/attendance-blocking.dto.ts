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
 * Blocking status response DTO
 *
 * Returns attendance blocking information for a student in a classroom.
 * Calculation uses PAST sessions only (startTime <= now), excluding future sessions.
 *
 * @example
 * {
 *   isBlocked: true,
 *   consecutiveAbsences: 3,
 *   threshold: 30,
 *   pastSessionsCount: 10,
 *   lastAbsenceDate: "2025-12-10T10:00:00Z"
 * }
 */
export class BlockingStatusDto {
  @ApiProperty({ description: 'Whether student is currently blocked' })
  isBlocked: boolean;

  @ApiPropertyOptional({ description: 'Date when student was blocked' })
  blockedAt?: Date;

  @ApiPropertyOptional({ description: 'Reason for blocking' })
  blockedReason?: string;

  @ApiProperty({
    description:
      'Total absence count from PAST sessions only (field name kept for backward compatibility). ' +
      'Percentage calculated as: absentCount / pastSessionsCount',
    example: 3,
  })
  consecutiveAbsences: number;

  @ApiProperty({
    description:
      'Absence percentage threshold as integer (e.g., 30 = 30%). ' +
      'Student blocked when (absentCount/pastSessions) >= (threshold/100)',
    example: 30,
    minimum: 10,
    maximum: 50,
  })
  threshold: number;

  @ApiPropertyOptional({
    description:
      'Number of past sessions (denominator for percentage calculation)',
  })
  pastSessionsCount?: number;

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
    description:
      'Absence percentage threshold as decimal (0.1 to 0.5 for 10% to 50%)',
    minimum: 0.1,
    maximum: 0.5,
    example: 0.3,
  })
  @IsOptional()
  absencePercentageThreshold?: number;
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
