import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CloneAssignmentDto {
  @ApiProperty({
    description: 'Target classroom ID to clone assignment into',
  })
  @IsString()
  targetClassroomId!: string;

  @ApiPropertyOptional({
    description: 'Selected activity IDs to include in the cloned assignment',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activityIds?: string[];

  @ApiPropertyOptional({
    description: 'Override title for the cloned assignment',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Override description for the cloned assignment',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Override instructions for the cloned assignment',
  })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({
    description: 'Due date (ISO 8601) for the cloned assignment',
    example: '2025-01-15T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Total points for the cloned assignment',
    default: 100,
  })
  @IsOptional()
  @IsInt()
  totalPoints?: number;

  @ApiPropertyOptional({
    description: 'Time limit in minutes',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimit?: number;

  @ApiPropertyOptional({
    description: 'Maximum attempts allowed',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @ApiPropertyOptional({
    description: 'Assignment weight (0-1)',
    default: 0,
  })
  @IsOptional()
  @Min(0)
  @Max(1)
  weight?: number;

  @ApiPropertyOptional({
    description: 'Publish cloned assignment immediately',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    description: 'Custom JSON content to override',
  })
  @IsOptional()
  customContent?: any;
}
