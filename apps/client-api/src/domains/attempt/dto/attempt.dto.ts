import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsJSON, IsOptional, IsUUID } from 'class-validator';

export class CreateAttemptDto {
    @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsUUID()
    userId: string;

    @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsUUID()
    activityId: string;

    @ApiPropertyOptional({ example: 100 })
    @IsOptional()
    @IsInt()
    score?: number;

    @ApiPropertyOptional({ example: {} })
    @IsOptional()
    @IsJSON()
    detail?: string;
}

export class UpdateAttemptDto {
    @ApiPropertyOptional({ example: 100 })
    @IsOptional()
    @IsInt()
    score?: number;

    @ApiPropertyOptional({ example: {} })
    @IsOptional()
    @IsJSON()
    detail?: string;
}

export class FilterAttemptRequestDto extends RequestPagingDto {
    @ApiPropertyOptional({ description: 'Filter by userId', example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsOptional()
    @IsUUID()
    userId?: string;

    @ApiPropertyOptional({ description: 'Filter by activityId', example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsOptional()
    @IsUUID()
    activityId?: string;
}
