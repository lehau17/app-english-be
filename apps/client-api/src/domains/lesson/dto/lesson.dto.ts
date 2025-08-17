import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateLessonDto {
    @ApiProperty({ example: 'Introduction to English Grammar' })
    @IsString()
    title: string;

    @ApiPropertyOptional({ example: 'A comprehensive course on the basics of English grammar.' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 1 })
    @IsInt()
    orderNo: number;

    @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsUUID()
    courseId: string;
}

export class UpdateLessonDto {
    @ApiPropertyOptional({ example: 'Advanced English Grammar' })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional({ example: 'An in-depth look at advanced grammar topics.' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: 2 })
    @IsOptional()
    @IsInt()
    orderNo?: number;
}

export class FilterLessonRequestDto extends RequestPagingDto {
    @ApiPropertyOptional({ description: 'Search by title', example: 'Grammar' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Filter by courseId', example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsOptional()
    @IsUUID()
    courseId?: string;
}