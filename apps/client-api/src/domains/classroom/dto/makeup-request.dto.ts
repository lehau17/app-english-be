import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MakeupRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsDate,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

/**
 * DTO for creating a makeup attendance request
 */
export class CreateMakeupRequestDto {
    @ApiProperty({
        example: 'Bị ốm, không thể đến lớp',
        description: 'Lý do xin điểm danh bù',
    })
    @IsString()
    @IsNotEmpty()
    reason: string;

    @ApiPropertyOptional({
        type: [String],
        example: ['https://example.com/medical-certificate.pdf'],
        description: 'URLs của minh chứng',
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    evidenceUrls?: string[];
}

/**
 * DTO for reviewing (approving/rejecting) a makeup request
 */
export class ReviewMakeupRequestDto {
    @ApiProperty({
        enum: ['approved', 'rejected'],
        example: 'approved',
        description: 'Trạng thái duyệt',
    })
    @IsEnum(['approved', 'rejected'])
    status: 'approved' | 'rejected';

    @ApiPropertyOptional({
        example: 'Đã xác minh giấy khám bệnh',
        description: 'Ghi chú của người duyệt',
    })
    @IsOptional()
    @IsString()
    reviewNote?: string;
}

/**
 * Query DTO for listing makeup requests
 */
export class QueryMakeupRequestDto {
    @ApiPropertyOptional({
        enum: MakeupRequestStatus,
        example: 'pending',
        description: 'Lọc theo trạng thái',
    })
    @IsOptional()
    @IsEnum(MakeupRequestStatus)
    status?: MakeupRequestStatus;

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
 * Response DTO for student info in makeup request
 */
export class MakeupRequestStudentDto {
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
 * Response DTO for session info in makeup request
 */
export class MakeupRequestSessionDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    startTime: Date;

    @ApiProperty()
    endTime: Date;

    @ApiPropertyOptional()
    classroomId?: string;
}

/**
 * Response DTO for reviewer info
 */
export class MakeupRequestReviewerDto {
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
 * Full response DTO for makeup attendance request
 */
export class MakeupRequestResponseDto {
    @ApiProperty({ example: 'uuid' })
    id: string;

    @ApiProperty({ example: 'uuid' })
    sessionId: string;

    @ApiProperty({ example: 'uuid' })
    studentId: string;

    @ApiProperty({ example: 'Bị ốm, không thể đến lớp' })
    reason: string;

    @ApiProperty({ type: [String] })
    evidenceUrls: string[];

    @ApiProperty({ enum: MakeupRequestStatus, example: 'pending' })
    status: MakeupRequestStatus;

    @ApiPropertyOptional({ example: 'uuid' })
    reviewedById?: string | null;

    @ApiPropertyOptional({ type: Date })
    reviewedAt?: Date | null;

    @ApiPropertyOptional({ example: 'Đã xác minh' })
    reviewNote?: string | null;

    @ApiProperty({ type: Date })
    createdAt: Date;

    @ApiProperty({ type: Date })
    updatedAt: Date;

    @ApiPropertyOptional({ type: MakeupRequestStudentDto })
    student?: MakeupRequestStudentDto;

    @ApiPropertyOptional({ type: MakeupRequestSessionDto })
    session?: MakeupRequestSessionDto;

    @ApiPropertyOptional({ type: MakeupRequestReviewerDto })
    reviewedBy?: MakeupRequestReviewerDto | null;
}

/**
 * Paginated response for makeup requests
 */
export class PaginatedMakeupRequestsDto {
    @ApiProperty({ type: [MakeupRequestResponseDto] })
    data: MakeupRequestResponseDto[];

    @ApiProperty({ example: 10 })
    total: number;

    @ApiProperty({ example: 1 })
    page: number;

    @ApiProperty({ example: 10 })
    limit: number;

    @ApiProperty({ example: 1 })
    totalPages: number;
}
