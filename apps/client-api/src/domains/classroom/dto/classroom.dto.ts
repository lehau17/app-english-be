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

export class ClassroomAnnouncementQueryDto extends RequestPagingDto {
  @ApiPropertyOptional({ description: 'Filter by priority', example: 'high' })
  @IsOptional()
  @IsString()
  priority?: string;
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

export class CreateClassroomAnnouncementDto {
  @ApiProperty({ example: 'Thông báo kiểm tra giữa kỳ' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Các em ôn tập chương 1 và 2, kiểm tra vào thứ 6.' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: ['high', 'normal', 'low'], example: 'normal' })
  @IsOptional()
  @IsString()
  priority?: string;
}

export class ImportStudentFromExcelDto {
  @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
  @IsUUID()
  classroomId: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Excel file containing student data',
  })
  file: Express.Multer.File;
}

export class StudentExcelDataDto {
  @ApiProperty({ example: 'student@example.com' })
  @IsString()
  email: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Nguyen' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Van A' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 'male' })
  @IsOptional()
  @IsString()
  gender?: string;
}

export class ImportStudentsResultDto {
  @ApiProperty({ example: 10 })
  @IsInt()
  totalProcessed: number;

  @ApiProperty({ example: 8 })
  @IsInt()
  successfullyImported: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  failedImports: number;

  @ApiProperty({ type: [Object] })
  @IsArray()
  errors: Array<{
    row: number;
    email: string;
    error: string;
  }>;

  @ApiProperty({ type: [Object] })
  @IsArray()
  createdStudents: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }>;

  @ApiProperty({ type: [Object] })
  @IsArray()
  existingStudents: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }>;
}
