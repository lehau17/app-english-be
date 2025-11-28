import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDate,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';

/**
 * Attendance status enum
 */
export enum AttendanceStatusDto {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused',
}

/**
 * DTO for marking single student attendance
 */
export class MarkAttendanceDto {
  @ApiProperty({
    enum: AttendanceStatusDto,
    example: 'present',
    description: 'Trạng thái điểm danh',
  })
  @IsEnum(AttendanceStatusDto)
  @IsNotEmpty()
  status: AttendanceStatusDto;

  @ApiPropertyOptional({
    type: Date,
    example: '2025-01-15T08:00:00.000Z',
    description: 'Thời gian check-in',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  checkInTime?: Date;

  @ApiPropertyOptional({
    type: Date,
    example: '2025-01-15T10:00:00.000Z',
    description: 'Thời gian check-out',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  checkOutTime?: Date;

  @ApiPropertyOptional({
    example: 'Đi muộn 10 phút do kẹt xe',
    description: 'Ghi chú',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Single attendance item in bulk request
 */
export class BulkAttendanceItemDto {
  @ApiProperty({
    example: 'uuid-student-id',
    description: 'ID của học sinh',
  })
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    enum: AttendanceStatusDto,
    example: 'present',
    description: 'Trạng thái điểm danh',
  })
  @IsEnum(AttendanceStatusDto)
  @IsNotEmpty()
  status: AttendanceStatusDto;

  @ApiPropertyOptional({
    type: Date,
    description: 'Thời gian check-in',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  checkInTime?: Date;

  @ApiPropertyOptional({
    type: Date,
    description: 'Thời gian check-out',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  checkOutTime?: Date;

  @ApiPropertyOptional({
    description: 'Ghi chú',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO for bulk marking attendance
 */
export class BulkAttendanceDto {
  @ApiProperty({
    type: [BulkAttendanceItemDto],
    description: 'Danh sách điểm danh',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceItemDto)
  attendances: BulkAttendanceItemDto[];
}

/**
 * Response DTO for attendance
 */
export class AttendanceResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 'uuid' })
  studentId: string;

  @ApiProperty({ enum: AttendanceStatusDto, example: 'present' })
  status: string;

  @ApiPropertyOptional({ type: Date })
  checkInTime?: Date | null;

  @ApiPropertyOptional({ type: Date })
  checkOutTime?: Date | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date })
  updatedAt: Date;
}

/**
 * Response DTO for attendance with student info
 */
export class AttendanceWithStudentDto extends AttendanceResponseDto {
  @ApiProperty({
    type: Object,
    example: {
      id: 'uuid',
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: 'https://...',
    },
  })
  student: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

/**
 * Response DTO for session attendance summary
 */
export class SessionAttendanceSummaryDto {
  @ApiProperty({ example: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 25 })
  totalStudents: number;

  @ApiProperty({ example: 20 })
  present: number;

  @ApiProperty({ example: 3 })
  absent: number;

  @ApiProperty({ example: 1 })
  late: number;

  @ApiProperty({ example: 1 })
  excused: number;

  @ApiProperty({ example: 84 })
  attendanceRate: number;

  @ApiProperty({ type: [AttendanceWithStudentDto] })
  attendances: AttendanceWithStudentDto[];
}

/**
 * Response DTO for student attendance history
 */
export class StudentAttendanceHistoryDto {
  @ApiProperty({ example: 10 })
  totalSessions: number;

  @ApiProperty({ example: 8 })
  attended: number;

  @ApiProperty({ example: 7 })
  present: number;

  @ApiProperty({ example: 1 })
  absent: number;

  @ApiProperty({ example: 1 })
  late: number;

  @ApiProperty({ example: 1 })
  excused: number;

  @ApiProperty({ example: 80 })
  attendanceRate: number;

  @ApiProperty({
    type: Array,
    example: [
      {
        sessionId: 'uuid',
        sessionTitle: 'Session 1',
        sessionDate: '2025-01-15T08:00:00.000Z',
        status: 'present',
      },
    ],
  })
  history: Array<{
    sessionId: string;
    sessionTitle: string;
    sessionDate: Date;
    status: string;
  }>;
}

/**
 * Response DTO for classroom attendance stats
 */
export class ClassroomAttendanceStatsDto {
  @ApiProperty({ example: 10 })
  totalSessions: number;

  @ApiProperty({ example: 85 })
  averageAttendanceRate: number;

  @ApiProperty({
    type: Array,
    example: [
      {
        studentId: 'uuid',
        studentName: 'John Doe',
        attendanceRate: 90,
        present: 9,
        absent: 0,
        late: 1,
        excused: 0,
      },
    ],
  })
  studentStats: Array<{
    studentId: string;
    studentName: string;
    attendanceRate: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  }>;
}

/**
 * Response DTO for unmarked students
 */
export class UnmarkedStudentDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'John Doe' })
  displayName: string;

  @ApiPropertyOptional({ example: 'https://...' })
  avatarUrl: string | null;
}

/**
 * Response for mark all absent
 */
export class MarkAllAbsentResponseDto {
  @ApiProperty({ example: 5 })
  markedCount: number;

  @ApiProperty({
    type: Array,
    example: [{ id: 'uuid', name: 'John Doe' }],
  })
  students: Array<{ id: string; name: string }>;
}

/**
 * Query DTO for student attendance history with pagination and filter
 */
export class StudentAttendanceHistoryQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Trang hiện tại (bắt đầu từ 1)',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Số bản ghi mỗi trang (tối đa 100)',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    type: Date,
    example: '2025-01-01T00:00:00.000Z',
    description: 'Lọc từ ngày',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fromDate?: Date;

  @ApiPropertyOptional({
    type: Date,
    example: '2025-12-31T23:59:59.000Z',
    description: 'Lọc đến ngày',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  toDate?: Date;

  @ApiPropertyOptional({
    enum: AttendanceStatusDto,
    description: 'Lọc theo trạng thái',
  })
  @IsOptional()
  @IsEnum(AttendanceStatusDto)
  status?: AttendanceStatusDto;
}

/**
 * Paginated response for student attendance history
 */
export class PaginatedStudentAttendanceHistoryDto {
  @ApiProperty({ example: 50 })
  totalSessions: number;

  @ApiProperty({ example: 40 })
  attended: number;

  @ApiProperty({ example: 35 })
  present: number;

  @ApiProperty({ example: 5 })
  absent: number;

  @ApiProperty({ example: 5 })
  late: number;

  @ApiProperty({ example: 5 })
  excused: number;

  @ApiProperty({ example: 80 })
  attendanceRate: number;

  @ApiProperty({
    type: Array,
    description: 'Danh sách lịch sử điểm danh (phân trang)',
  })
  history: Array<{
    sessionId: string;
    sessionTitle: string;
    sessionDate: Date;
    status: string;
  }>;

  @ApiProperty({
    description: 'Thông tin phân trang',
    example: {
      page: 1,
      limit: 20,
      totalItems: 50,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: false,
    },
  })
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
