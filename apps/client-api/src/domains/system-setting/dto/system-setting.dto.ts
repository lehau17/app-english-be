import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateSystemSettingDto {
    @IsString()
    @IsNotEmpty()
    value: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsBoolean()
    @IsOptional()
    isPublic?: boolean;
}

export class CreateSystemSettingDto extends UpdateSystemSettingDto {
    @IsString()
    @IsNotEmpty()
    key: string;
}
