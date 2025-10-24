import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassroomStatus, TimezoneCode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDate,
    IsEnum,
    IsInt,
    IsISO8601,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
    ValidateIf,
    ValidateNested,
} from 'class-validator';

export enum Weekday {
    mon = 'mon',
    tue = 'tue',
    wed = 'wed',
    thu = 'thu',
    fri = 'fri',
    sat = 'sat',
    sun = 'sun',
}

export class CreateClassroomSlotDto {
    @ApiPropertyOptional({
        description: 'Slot identifier (optional when editing existing slot)',
    })
    @IsOptional()
    @IsUUID()
    id?: string;

    @ApiProperty({ enum: Weekday, example: 'tue' })
    @IsEnum(Weekday)
    dayOfWeek: Weekday;

    @ApiProperty({
        example: 390,
        description: 'Start time in minutes from 00:00 (e.g., 6:30 = 390)',
    })
    @IsInt()
    @Min(0)
    @Max(1439) // 23:59 = 1439 minutes
    startMinuteOfDay: number;

    @ApiProperty({
        example: 480,
        description: 'End time in minutes from 00:00 (e.g., 8:00 = 480)',
    })
    @IsInt()
    @Min(0)
    @Max(1439)
    endMinuteOfDay: number;
}

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

    @ApiPropertyOptional({ type: Date, description: 'Class start date', example: '2024-07-01' })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    periodStart?: Date;

    @ApiPropertyOptional({ type: Date, description: 'Class end date', example: '2024-08-30' })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    periodEnd?: Date;

    @ApiPropertyOptional({ example: true, description: 'Tự động tính toán thời gian dựa trên số buổi học của khóa học' })
    @IsOptional()
    @IsBoolean()
    autoCalculateDates?: boolean;

    @ApiProperty({
        type: [CreateClassroomSlotDto],
        description: 'Weekly schedule slots (e.g., Mon 6:30-8:00, Sat 7:30-9:00)',
        example: [
            { dayOfWeek: 'mon', startMinuteOfDay: 390, endMinuteOfDay: 480 },
            { dayOfWeek: 'sat', startMinuteOfDay: 450, endMinuteOfDay: 540 },
        ],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateClassroomSlotDto)
    slots: CreateClassroomSlotDto[];
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

    @ApiPropertyOptional({
        description: 'Filter by classroom status',
        enum: ClassroomStatus,
        example: ClassroomStatus.ongoing,
    })
    @IsOptional()
    @IsEnum(ClassroomStatus)
    status?: ClassroomStatus;

    @ApiPropertyOptional({
        description:
            'Filter by student ID to get classrooms where student is enrolled',
        example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
    })
    @IsOptional()
    @IsUUID()
    studentId?: string;

    @ApiPropertyOptional({
        description: 'Include payment status for student',
        example: true,
    })
    @IsOptional()
    @IsBoolean()
    includePaymentStatus?: boolean;
}

export class ClassroomAnnouncementQueryDto extends RequestPagingDto {
    @ApiPropertyOptional({ description: 'Filter by priority', example: 'high' })
    @IsOptional()
    @IsString()
    priority?: string;
}

export class StudentDailyScheduleQueryDto {
    @ApiPropertyOptional({
        description: 'Target date (ISO 8601). Defaults to today.',
        example: '2025-05-25',
    })
    @IsOptional()
    @IsISO8601({ strict: true })
    date?: string;

    @ApiPropertyOptional({
        enum: TimezoneCode,
        description:
            'Preferred timezone for formatting results. Defaults to Asia_Ho_Chi_Minh.',
    })
    @IsOptional()
    @IsEnum(TimezoneCode)
    timezone?: TimezoneCode;
}

export class StudentWeeklyScheduleQueryDto {
    @ApiPropertyOptional({
        description:
            'Start date (Monday) in ISO 8601. Defaults to current week start.',
        example: '2025-05-19',
    })
    @IsOptional()
    @IsISO8601({ strict: true })
    weekStart?: string;

    @ApiPropertyOptional({
        description: 'Number of days to include. Defaults to 7.',
        example: 7,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(14)
    days?: number;

    @ApiPropertyOptional({
        enum: TimezoneCode,
        description:
            'Preferred timezone for formatting results. Defaults to Asia_Ho_Chi_Minh.',
    })
    @IsOptional()
    @IsEnum(TimezoneCode)
    timezone?: TimezoneCode;
}

export class SystemScheduleQueryDto {
    @ApiPropertyOptional({
        description: 'Start date (Monday) in ISO 8601. Defaults to current week start.',
        example: '2025-05-19',
    })
    @IsOptional()
    @IsISO8601({ strict: true })
    weekStart?: string;

    @ApiPropertyOptional({
        description: 'Number of days to include. Defaults to 7 (1 week). Max 31 for monthly view.',
        example: 7,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(31)
    days?: number;

    @ApiPropertyOptional({
        enum: TimezoneCode,
        description: 'Preferred timezone. Defaults to Asia_Ho_Chi_Minh.',
    })
    @IsOptional()
    @IsEnum(TimezoneCode)
    timezone?: TimezoneCode;

    @ApiPropertyOptional({
        description: 'Filter by teacher ID',
        example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
    })
    @IsOptional()
    @ValidateIf((o) => o.teacherId !== undefined && o.teacherId !== null && o.teacherId !== '')
    @IsUUID('4')
    teacherId?: string;

    @ApiPropertyOptional({
        description: 'Filter by classroom ID',
        example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
    })
    @IsOptional()
    @ValidateIf((o) => o.classroomId !== undefined && o.classroomId !== null && o.classroomId !== '')
    @IsUUID('4')
    classroomId?: string;

    @ApiPropertyOptional({
        description: 'Filter by session status (SCHEDULED, COMPLETED, CANCELLED)',
        example: 'SCHEDULED',
    })
    @IsOptional()
    @IsString()
    status?: string;
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

// ==================== STATUS UPDATE DTOs ====================

export class UpdateClassroomStatusDto {
    @ApiProperty({
        enum: ClassroomStatus,
        example: ClassroomStatus.ongoing,
        description: 'New status for the classroom',
    })
    @IsEnum(ClassroomStatus)
    @IsNotEmpty()
    status: ClassroomStatus;
}

// ==================== TRANSFER STUDENT DTOs ====================

export class TransferStudentDto {
    @ApiProperty({
        description: 'ID của học sinh cần chuyển lớp',
        example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
    })
    @IsUUID()
    @IsNotEmpty()
    studentId: string;

    @ApiProperty({
        description: 'ID của lớp học hiện tại',
        example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
    })
    @IsUUID()
    @IsNotEmpty()
    currentClassroomId: string;

    @ApiProperty({
        description: 'ID của lớp học mới',
        example: 'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    })
    @IsUUID()
    @IsNotEmpty()
    newClassroomId: string;
}
