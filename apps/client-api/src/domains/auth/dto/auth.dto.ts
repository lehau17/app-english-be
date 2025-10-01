import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

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

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldP@ssw0rd!' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewP@ssw0rd!' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'kid.parent@example.com' })
  @IsEmail()
  email: string;
}

// dto/reset-password.dto.ts

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from email', example: 'reset-token-abc' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewP@ssw0rd!' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'Nguyen Van A' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiProperty({ required: false, example: 'student@example.com' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @ApiProperty({ required: false, example: 'Nguyen' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @ApiProperty({ required: false, example: 'Van A' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiProperty({ required: false, example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\//, {
    message: 'avatarUrl must be a valid URL',
  })
  avatarUrl?: string;
}
