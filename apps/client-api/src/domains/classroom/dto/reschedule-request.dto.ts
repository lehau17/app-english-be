import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionRescheduleRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDate,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateIf
} from 'class-validator';

/**
 * DTO for creating a session reschedule request
 */
export class CreateRescheduleRequestDto {
    @ApiProperty({
        example: '2025-12-15T10:00:00Z',
        description: 'New start time for the session',
    })
    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    newStartTime: Date;

    @ApiProperty({
        example: '2025-12-15T12:00:00Z',
        description: 'New end time for the session',
    })
    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    newEndTime: Date;

    @ApiProperty({
        example: 'Giáo viên có việc đột xuất, cần dời buổi học',
        description: 'Lý do dời buổi học',
    })
    @IsString()
    @IsNotEmpty()
    reason: string;

    @ApiPropertyOptional({
        type: [String],
        example: ['https://example.com/evidence.pdf'],
        description: 'URLs của minh chứng (ảnh, file...)',
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    evidenceUrls?: string[];
}

/**
 * DTO for updating a pending reschedule request
 */
export class UpdateRescheduleRequestDto {
    @ApiPropertyOptional({
        example: '2025-12-15T10:00:00Z',
        description: 'New start time for the session',
    })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    newStartTime?: Date;

    @ApiPropertyOptional({
        example: '2025-12-15T12:00:00Z',
        description: 'New end time for the session',
    })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    newEndTime?: Date;

    @ApiPropertyOptional({
        example: 'Giáo viên có việc đột xuất, cần dời buổi học',
        description: 'Lý do dời buổi học',
    })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiPropertyOptional({
        type: [String],
        example: ['https://example.com/evidence.pdf'],
        description: 'URLs của minh chứng (ảnh, file...)',
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    evidenceUrls?: string[];
}

/**
 * DTO for reviewing (approving/rejecting) a reschedule request
 */
export class ReviewRescheduleRequestDto {
    @ApiProperty({
        example: true,
        description: 'true để approve, false để reject',
    })
    @IsBoolean()
    approved: boolean;

    @ApiPropertyOptional({
        example: 'Đã kiểm tra lịch, không có xung đột',
        description: 'Ghi chú của người duyệt. Bắt buộc khi từ chối (approved=false)',
    })
    @ValidateIf((o) => !o.approved)
    @IsNotEmpty({ message: 'Lý do từ chối là bắt buộc' })
    @IsString({ message: 'Lý do từ chối phải là chuỗi ký tự' })
    @IsOptional()
    reviewNote?: string;
}

/**
 * Query DTO for listing reschedule requests
 */
export class QueryRescheduleRequestDto {
    @ApiPropertyOptional({
        enum: SessionRescheduleRequestStatus,
        example: 'pending',
        description: 'Lọc theo trạng thái',
    })
    @IsOptional()
    @IsEnum(SessionRescheduleRequestStatus)
    status?: SessionRescheduleRequestStatus;

    @ApiPropertyOptional({
        example: 1,
        description: 'Số trang',
    })
    @IsOptional()
    @Type(() => Number)
    page?: number;

    @ApiPropertyOptional({
        example: 10,
        description: 'Số lượng mỗi trang',
    })
    @IsOptional()
    @Type(() => Number)
    limit?: number;
}

/**
 * Response DTO for requester info in reschedule request
 */
export class RescheduleRequestRequesterDto {
    @ApiProperty()
    id: string;

    @ApiPropertyOptional()
    firstName?: string;

    @ApiPropertyOptional()
    lastName?: string;

    @ApiPropertyOptional()
    displayName?: string;

    @ApiPropertyOptional()
    avatarUrl?: string;

    @ApiPropertyOptional()
    email?: string;
}

/**
 * Response DTO for session info in reschedule request
 */
export class RescheduleRequestSessionDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    startTime: Date;

    @ApiProperty()
    endTime: Date;

    @ApiProperty()
    classroomId: string;

    @ApiProperty()
    instructorId: string;
}

/**
 * Response DTO for reviewer info
 */
export class RescheduleRequestReviewerDto {
    @ApiProperty()
    id: string;

    @ApiPropertyOptional()
    firstName?: string;

    @ApiPropertyOptional()
    lastName?: string;

    @ApiPropertyOptional()
    displayName?: string;
}

/**
 * Full response DTO for session reschedule request
 */
export class RescheduleRequestResponseDto {
    @ApiProperty({ example: 'uuid' })
    id: string;

    @ApiProperty({ example: 'uuid' })
    sessionId: string;

    @ApiProperty({ example: 'uuid' })
    requestedById: string;

    @ApiProperty({ type: Date })
    newStartTime: Date;

    @ApiProperty({ type: Date })
    newEndTime: Date;

    @ApiProperty({ example: 'Giáo viên có việc đột xuất' })
    reason: string;

    @ApiProperty({ type: [String] })
    evidenceUrls: string[];

    @ApiProperty({ enum: SessionRescheduleRequestStatus, example: 'pending' })
    status: SessionRescheduleRequestStatus;

    @ApiPropertyOptional({ example: 'uuid' })
    reviewedById?: string | null;

    @ApiPropertyOptional({ type: Date })
    reviewedAt?: Date | null;

    @ApiPropertyOptional({ example: 'Đã kiểm tra' })
    reviewNote?: string | null;

    @ApiProperty({ type: Date })
    createdAt: Date;

    @ApiProperty({ type: Date })
    updatedAt: Date;

    @ApiPropertyOptional({ type: RescheduleRequestRequesterDto })
    requestedBy?: RescheduleRequestRequesterDto;

    @ApiPropertyOptional({ type: RescheduleRequestSessionDto })
    session?: RescheduleRequestSessionDto;

    @ApiPropertyOptional({ type: RescheduleRequestReviewerDto })
    reviewedBy?: RescheduleRequestReviewerDto | null;
}

/**
 * Paginated response for reschedule requests
 */
export class PaginatedRescheduleRequestsDto {
    @ApiProperty({ type: [RescheduleRequestResponseDto] })
    data: RescheduleRequestResponseDto[];

    @ApiProperty({ example: 10 })
    total: number;

    @ApiProperty({ example: 1 })
    page: number;

    @ApiProperty({ example: 10 })
    limit: number;

    @ApiProperty({ example: 1 })
    totalPages: number;
}

