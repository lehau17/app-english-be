import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { AssignmentActivityDto } from './create-assignment.dto';

export class UpdateAssignmentDto {
  @ApiPropertyOptional({ description: 'Assignment title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    enum: AssignmentType,
    description: 'Type of the assignment',
  })
  @IsEnum(AssignmentType)
  @IsOptional()
  type?: AssignmentType;

  @ApiPropertyOptional({
    description:
      'Weight of the assignment in the final grade (e.g., 0.4 for 40%)',
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ description: 'Assignment description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Assignment instructions' })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional({
    description: 'Start time for assignment (when students can begin)',
    example: '2024-12-01T08:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Due date for assignment',
    example: '2024-12-31T17:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Total points possible', minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  totalPoints?: number;

  @ApiPropertyOptional({ description: 'Time limit in minutes' })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  timeLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum attempts allowed', minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  maxAttempts?: number;

  @ApiPropertyOptional({ description: 'Publish/unpublish assignment' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isPublished?: boolean;

  @ApiPropertyOptional({
    description: 'Assign to specific students (user IDs)',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assignedTo?: string[];

  @ApiPropertyOptional({
    description: 'Activities in this assignment',
    type: [AssignmentActivityDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentActivityDto)
  @IsOptional()
  activities?: AssignmentActivityDto[];

  @ApiPropertyOptional({ description: 'Custom content as JSON' })
  @IsObject()
  @IsOptional()
  customContent?: any;
}
