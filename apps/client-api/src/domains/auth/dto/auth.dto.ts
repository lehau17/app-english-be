import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        description: 'Email đăng nhập',
        example: 'kid.parent@example.com',
    })
    @IsEmail({}, { message: 'email must be a valid email address' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    email: string;

    @ApiProperty({
        description: 'Mật khẩu',
        example: 'P@ssw0rd!',
        minLength: 6,
    })
    @IsString()
    @MinLength(6, { message: 'password must be at least 6 characters' })
    password: string;
}

export class RegisterDto {
    @ApiProperty({
        description: 'Email (unique)',
        example: 'kid.parent@example.com',
        required: false,
    })
    @IsOptional()
    @IsEmail({}, { message: 'email must be a valid email address' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    email?: string;

    @ApiProperty({
        description: 'Số điện thoại (unique)',
        example: '+84901234567',
        required: false,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    phone?: string;

    @ApiProperty({
        description: 'Username (unique)',
        example: 'kiddo123',
        required: false,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    username?: string;

    @ApiProperty({
        description: 'Mật khẩu',
        example: 'P@ssw0rd!',
        minLength: 6,
    })
    @IsString()
    @MinLength(6, { message: 'password must be at least 6 characters' })
    password: string;

    @ApiProperty({ description: 'Tên', example: 'Huyen Trang' })
    @IsString()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    firstName: string;

    @ApiProperty({ description: 'Họ', example: 'Pham' })
    @IsString()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    lastName: string;
}


export class LogoutDto {
    @ApiProperty({
        description: 'Refresh token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsString()
    refreshToken: string;
}


export class RefreshTokenDto {
    @ApiProperty({
        description: 'Refresh token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsString()
    refreshToken: string;
}
