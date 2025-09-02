import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateClassroomDto {
  @ApiProperty({ example: 'Lop hoc 1' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Mo ta lop hoc 1' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
  @IsUUID()
  teacherId: string;

  @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
  @IsUUID()
  courseId: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  maxStudents: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ type: Date })
  @Type(() => Date)
  @IsDate()
  periodStart: Date;

  @ApiProperty({ type: Date })
  @Type(() => Date)
  @IsDate()
  periodEnd: Date;

  @ApiProperty({ example: 36 })
  @IsNumber()
  plannedHours: number;

  @ApiProperty({ example: 1.5 })
  @IsNumber()
  sessionDurationHours: number;
}

export class UpdateClassroomDto {
  @ApiPropertyOptional({ example: 'Lop hoc 1' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Mo ta lop hoc 1' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;
}

export class FilterClassroomRequestDto extends RequestPagingDto {
  @ApiPropertyOptional({ description: 'Search by name', example: 'Lop hoc' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by teacherId',
    example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
  })
  @IsOptional()
  @IsUUID()
  teacherId?: string;
}

export class AddStudentToClassroomDto {
  @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
  @IsArray()
  @IsNotEmpty({ each: true })
  studentIds: string[];
}

export class AssignTeacherToClassroomDto {
  @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
  @IsUUID()
  teacherId: string;
}
