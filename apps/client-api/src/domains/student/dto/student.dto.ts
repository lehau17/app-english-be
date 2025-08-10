import { RequestPagingDto } from "@app/shared";
import { Gender, LanguageCode, TimezoneCode } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class FilterStudentRequestDto extends RequestPagingDto { }




export class UpdateStudentDto {
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    username?: string;

    @IsOptional()
    @MinLength(6)
    password?: string;

    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsEnum(Gender)
    gender?: Gender;

    @IsOptional()
    @IsEnum(LanguageCode)
    language?: LanguageCode;

    @IsOptional()
    @IsEnum(TimezoneCode)
    timezone?: TimezoneCode;
}



export class CreateStudentDto {
    @IsEmail()
    email: string;

    @IsString()
    username: string;

    @MinLength(6)
    password: string;

    @IsString()
    firstName: string;

    @IsString()
    lastName: string;

    @IsOptional()
    @IsEnum(Gender)
    gender?: Gender;

    @IsOptional()
    @IsEnum(LanguageCode)
    language?: LanguageCode;

    @IsOptional()
    @IsEnum(TimezoneCode)
    timezone?: TimezoneCode;
}
