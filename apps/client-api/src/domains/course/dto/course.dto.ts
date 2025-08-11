
import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateCourseDto {
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
}

export class UpdateCourseDto {
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

export class FilterCourseRequestDto extends RequestPagingDto {
    @ApiPropertyOptional({ description: 'Search by title', example: 'Grammar' })
    @IsOptional()
    @IsString()
    search?: string;
}
