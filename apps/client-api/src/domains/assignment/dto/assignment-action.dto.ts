import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class SubmitAssignmentDto {
  @ApiProperty({
    description: 'Student answers as JSON object',
    example: { activity1: { q1: 'answer1', q2: 'answer2' }, activity2: {} },
  })
  @IsObject()
  answers: any;

  @ApiPropertyOptional({ description: 'Time spent on assignment in seconds' })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  timeSpent?: number;

  @ApiPropertyOptional({ description: 'Additional notes or comments' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class GradeAssignmentDto {
  @ApiProperty({ description: 'Score for the assignment', minimum: 0 })
  @IsInt()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  score: number;

  @ApiPropertyOptional({ description: 'Feedback from teacher' })
  @IsString()
  @IsOptional()
  feedback?: string;
}

export class QueryAssignmentsDto {
  @ApiPropertyOptional({ description: 'Classroom ID to filter assignments' })
  @IsString()
  @IsOptional()
  classroomId?: string;

  @ApiPropertyOptional({
    description: 'Assignment status',
    enum: ['draft', 'published', 'completed', 'overdue', 'submitted', 'graded'],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20;
}
