import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SessionType, SessionTypeChangeStatus } from '@prisma/client';

/**
 * DTO for admin directly updating session type
 */
export class UpdateSessionTypeDto {
  @ApiProperty({
    description: 'New session type',
    enum: SessionType,
    example: SessionType.online,
  })
  @IsEnum(SessionType)
  type: SessionType;

  @ApiPropertyOptional({
    description:
      'Whether to generate Google Meet link (auto true for online sessions)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  generateMeetLink?: boolean = true;
}

/**
 * DTO for teacher creating session type change request
 */
export class CreateSessionTypeChangeRequestDto {
  @ApiProperty({
    description: 'Requested new session type',
    enum: SessionType,
    example: SessionType.online,
  })
  @IsEnum(SessionType)
  requestedType: SessionType;

  @ApiProperty({
    description: 'Reason for requesting the type change',
    example: 'Need to conduct class online due to weather conditions',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

/**
 * DTO for admin reviewing (approving/rejecting) a request
 */
export class ReviewSessionTypeChangeRequestDto {
  @ApiProperty({
    description: 'Review decision',
    enum: ['approved', 'rejected'],
    example: 'approved',
  })
  @IsEnum(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @ApiPropertyOptional({
    description: 'Review note/comment (required when rejecting)',
    example: 'Approved - online session is appropriate for current situation',
  })
  @IsOptional()
  @IsString()
  reviewNote?: string;
}

/**
 * Response DTO for session type change request
 */
export class SessionTypeChangeRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sessionId: string;

  @ApiProperty({ enum: SessionType })
  currentType: SessionType;

  @ApiProperty({ enum: SessionType })
  requestedType: SessionType;

  @ApiProperty()
  reason: string;

  @ApiProperty({ enum: SessionTypeChangeStatus })
  status: SessionTypeChangeStatus;

  @ApiProperty({
    description: 'Teacher who requested the change',
    type: 'object',
  })
  requestedBy: {
    id: string;
    name: string;
    email: string;
  };

  @ApiPropertyOptional({
    description: 'Admin who reviewed the request',
    type: 'object',
  })
  reviewedBy?: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional()
  reviewedAt?: Date;

  @ApiPropertyOptional()
  reviewNote?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Query DTO for filtering requests
 */
export class QuerySessionTypeChangeRequestDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: SessionTypeChangeStatus,
  })
  @IsOptional()
  @IsEnum(SessionTypeChangeStatus)
  status?: SessionTypeChangeStatus;

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
