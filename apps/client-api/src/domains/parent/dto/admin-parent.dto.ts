import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsArray,
    IsEmail,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
    MinLength,
} from 'class-validator';

export class CreateParentDto {
    @ApiProperty({ description: 'Parent email', example: 'parent@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ description: 'Parent password', minLength: 6 })
    @IsString()
    @MinLength(6)
    password: string;

    @ApiProperty({ description: 'Parent first name', example: 'Nguyen' })
    @IsString()
    firstName: string;

    @ApiProperty({ description: 'Parent last name', example: 'Van A' })
    @IsString()
    lastName: string;

    @ApiPropertyOptional({
        description: 'Parent display name',
        example: 'Nguyen Van A',
    })
    @IsOptional()
    @IsString()
    displayName?: string;

    @ApiPropertyOptional({
        description: 'Parent phone number',
        example: '+84901234567',
    })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Parent address' })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiPropertyOptional({
        description: 'Parent experience in years',
        example: 5,
        minimum: 0,
        maximum: 50
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsInt()
    @Min(0)
    @Max(50)
    experience?: number;

    @ApiPropertyOptional({
        description: 'Parent highlights/specialties',
        example: ['IELTS 8.0', 'TOEIC 950', 'Business English'],
        type: [String]
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    highlights?: string[];
}

export class UpdateParentDto {
    @ApiPropertyOptional({ description: 'Parent first name' })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiPropertyOptional({ description: 'Parent last name' })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiPropertyOptional({ description: 'Parent display name' })
    @IsOptional()
    @IsString()
    displayName?: string;

    @ApiPropertyOptional({ description: 'Parent phone number' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Parent address' })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiPropertyOptional({ description: 'Parent avatar URL' })
    @IsOptional()
    @IsString()
    avatarUrl?: string;

    @ApiPropertyOptional({
        description: 'Parent experience in years',
        example: 5,
        minimum: 0,
        maximum: 50
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsInt()
    @Min(0)
    @Max(50)
    experience?: number;

    @ApiPropertyOptional({
        description: 'Parent highlights/specialties',
        example: ['IELTS 8.0', 'TOEIC 950', 'Business English'],
        type: [String]
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    highlights?: string[];
}

export class ParentListQueryDto {
    @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Items per page',
        default: 20,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Search by name or email' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Filter by active status' })
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    isActive?: boolean;

    @ApiPropertyOptional({
        description: 'Sort by field',
        enum: ['createdAt', 'firstName', 'lastName', 'email'],
    })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiPropertyOptional({
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'desc',
    })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc';
}

export class AssignParentDto {
    @ApiProperty({
        description: 'Array of student IDs to assign to parent',
        type: [String],
    })
    @IsArray()
    @IsUUID('4', { each: true })
    studentIds: string[];
}
