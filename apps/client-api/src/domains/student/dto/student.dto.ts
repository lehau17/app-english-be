import { RequestPagingDto } from "@app/shared";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, LanguageCode, TimezoneCode } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class FilterStudentRequestDto extends RequestPagingDto {
    @ApiPropertyOptional({ description: 'Số điện thoại để tìm kiếm', example: '0901234567' })
    @IsOptional()
    @IsString()
    phone?: string;
}

export class UpdateStudentDto {
    @ApiPropertyOptional({ example: 'student@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: '0901234567' })
    @IsOptional()
    @Matches(/^(0|\+84)\d{9}$/, { message: 'Số điện thoại không hợp lệ' })
    phone?: string;

    @ApiPropertyOptional({ example: 'username123' })
    @IsOptional()
    @IsString()
    username?: string;

    @ApiPropertyOptional({ example: 'secret123' })
    @IsOptional()
    @MinLength(6)
    password?: string;

    @ApiPropertyOptional({ example: 'Nguyen' })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiPropertyOptional({ example: 'Van A' })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiPropertyOptional({ enum: Gender, example: Gender.male })
    @IsOptional()
    @IsEnum(Gender)
    gender?: Gender;

    @ApiPropertyOptional({ enum: LanguageCode, example: LanguageCode.vi })
    @IsOptional()
    @IsEnum(LanguageCode)
    language?: LanguageCode;

    @ApiPropertyOptional({ enum: TimezoneCode, example: TimezoneCode.Asia_Ho_Chi_Minh })
    @IsOptional()
    @IsEnum(TimezoneCode)
    timezone?: TimezoneCode;
}

export class CreateStudentDto {
    @ApiProperty({ example: 'student@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: '0901234567' })
    @Matches(/^(0|\+84)\d{9}$/, { message: 'Số điện thoại không hợp lệ' })
    phone: string;


    @ApiProperty({ example: 'secret123' })
    @MinLength(6)
    password: string;

    @ApiProperty({ example: 'Nguyen' })
    @IsString()
    firstName: string;

    @ApiProperty({ example: 'Van A' })
    @IsString()
    lastName: string;

    @ApiPropertyOptional({ enum: Gender, example: Gender.male })
    @IsOptional()
    @IsEnum(Gender)
    gender?: Gender;

    @ApiPropertyOptional({ enum: LanguageCode, example: LanguageCode.vi })
    @IsOptional()
    @IsEnum(LanguageCode)
    language?: LanguageCode;

    @ApiPropertyOptional({ enum: TimezoneCode, example: TimezoneCode.Asia_Ho_Chi_Minh })
    @IsOptional()
    @IsEnum(TimezoneCode)
    timezone?: TimezoneCode;

  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  displayName: string;
}
