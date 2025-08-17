import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityType } from '@prisma/client';
import { IsEnum, IsInt, IsJSON, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateActivityDto {
    @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsUUID()
    lessonId: string;

    @ApiProperty({ enum: ActivityType, example: ActivityType.listening })
    @IsEnum(ActivityType)
    type: ActivityType;

    @ApiProperty({ example: 1 })
    @IsInt()
    orderNo: number;

    @ApiProperty({ example: {} })
    @IsJSON()
    content: string;
}

export class UpdateActivityDto {
    @ApiPropertyOptional({ enum: ActivityType, example: ActivityType.listening })
    @IsOptional()
    @IsEnum(ActivityType)
    type?: ActivityType;

    @ApiPropertyOptional({ example: 2 })
    @IsOptional()
    @IsInt()
    orderNo?: number;

    @ApiPropertyOptional({ example: {} })
    @IsOptional()
    @IsJSON()
    content?: string;
}

export class FilterActivityRequestDto extends RequestPagingDto {
    @ApiPropertyOptional({ description: 'Search by content', example: 'Grammar' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Filter by lessonId', example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsOptional()
    @IsUUID()
    lessonId?: string;

    @ApiPropertyOptional({ enum: ActivityType, description: 'Filter by type' })
    @IsOptional()
    @IsEnum(ActivityType)
    type?: ActivityType;
}
