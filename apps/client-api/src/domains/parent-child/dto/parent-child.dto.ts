import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LinkRequestStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateParentChildDto {
    @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsUUID()
    parentId: string;

    @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsUUID()
    childId: string;
}

export class FilterParentChildRequestDto extends RequestPagingDto {
    @ApiPropertyOptional({
        description: 'Filter by parentId',
        example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
    })
    @IsUUID()
    parentId?: string;

    @ApiPropertyOptional({
        description: 'Filter by childId',
        example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
    })
    @IsUUID()
    childId?: string;
}

// ==================== LINK REQUEST DTOs ====================

export class CreateLinkRequestDto {
    @ApiProperty({
        description: 'Email của học sinh (trong tương lai có thể hỗ trợ studentCode)',
        example: 'student@example.com',
    })
    @IsString()
    @IsNotEmpty()
    studentIdentifier: string;
}

export class GetPendingRequestsDto extends RequestPagingDto {
    @ApiPropertyOptional({
        description: 'Filter by status',
        enum: LinkRequestStatus,
        example: LinkRequestStatus.PENDING,
    })
    @IsOptional()
    @IsEnum(LinkRequestStatus)
    status?: LinkRequestStatus;

    @ApiPropertyOptional({
        description: 'Filter by parentId',
        example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
    })
    @IsOptional()
    @IsUUID()
    parentId?: string;

    @ApiPropertyOptional({
        description: 'Filter by studentId',
        example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
    })
    @IsOptional()
    @IsUUID()
    studentId?: string;
}
