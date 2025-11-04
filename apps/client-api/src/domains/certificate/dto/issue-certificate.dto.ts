import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class IssueCertificateDto {
  @ApiProperty({ description: 'Student ID' })
  @IsString()
  studentId: string;

  @ApiProperty({ description: 'Course ID' })
  @IsString()
  courseId: string;

  @ApiPropertyOptional({ description: 'Classroom ID (if applicable)' })
  @IsString()
  @IsOptional()
  classroomId?: string;

  @ApiPropertyOptional({ description: 'Final score (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  finalScore?: number;

  @ApiPropertyOptional({
    description: 'Progress percentage (0-100)',
    default: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  progress?: number;

  @ApiPropertyOptional({ description: 'Total hours spent' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalHours?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: any;
}
