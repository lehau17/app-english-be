import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

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

  @ApiProperty({ description: 'Phone number', example: '+84901234567' })
  @IsString()
  phone: string;

  @ApiProperty({ description: 'Display Name', example: 'John Doe' })
  @IsString()
  displayName?: string | null;

  @ApiProperty({ description: 'Gender', example: 'MALE' })
  @IsOptional()
  gender?: Gender | null;
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

  @ApiPropertyOptional({ description: 'Avatar URL', example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class FilterTeacherRequestDto extends RequestPagingDto {
  @ApiPropertyOptional({
    description: 'Search by name or email',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
