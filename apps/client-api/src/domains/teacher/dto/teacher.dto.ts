import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTeacherDto {
    @ApiProperty({
        description: 'Email (unique)',
        example: 'teacher@example.com',
    })
    @IsEmail({}, { message: 'email must be a valid email address' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    email: string;

    @ApiProperty({
        description: 'Password',
        example: 'P@ssw0rd!',
        minLength: 6,
    })
    @IsString()
    @MinLength(6, { message: 'password must be at least 6 characters' })
    password: string;

    @ApiProperty({ description: 'First Name', example: 'John' })
    @IsString()
    firstName: string;

    @ApiProperty({ description: 'Last Name', example: 'Doe' })
    @IsString()
    lastName: string;
}

export class UpdateTeacherDto {
    @ApiPropertyOptional({ description: 'First Name', example: 'John' })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiPropertyOptional({ description: 'Last Name', example: 'Doe' })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiPropertyOptional({ description: 'Phone number', example: '+84901234567' })
    @IsOptional()
    @IsString()
    phone?: string;
}

export class FilterTeacherRequestDto extends RequestPagingDto {
    @ApiPropertyOptional({ description: 'Search by name or email', example: 'John' })
    @IsOptional()
    @IsString()
    search?: string;
}
