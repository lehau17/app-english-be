import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'
import { AssignmentActivityDto } from './create-assignment.dto'

export class UpdateAssignmentDto {
  @ApiPropertyOptional({ description: 'Assignment title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Assignment description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Assignment instructions' })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Due date for assignment', example: '2024-12-31T17:00:00Z' })
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

  @ApiPropertyOptional({ description: 'Assign to specific students (user IDs)', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assignedTo?: string[];

  @ApiPropertyOptional({ description: 'Activities in this assignment', type: [AssignmentActivityDto] })
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
