import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DevicePlatform } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDeviceTokenDto {
    @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsUUID()
    userId: string;

    @ApiProperty({ example: 'fcm-token' })
    @IsString()
    token: string;

    @ApiProperty({ enum: DevicePlatform, example: DevicePlatform.web })
    @IsEnum(DevicePlatform)
    platform: DevicePlatform;
}

export class UpdateDeviceTokenDto {
    @ApiPropertyOptional({ example: 'new-fcm-token' })
    @IsOptional()
    @IsString()
    token?: string;

    @ApiPropertyOptional({ enum: DevicePlatform, example: DevicePlatform.android })
    @IsOptional()
    @IsEnum(DevicePlatform)
    platform?: DevicePlatform;
}

export class FilterDeviceTokenRequestDto extends RequestPagingDto {
    @ApiPropertyOptional({ description: 'Filter by userId', example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsOptional()
    @IsUUID()
    userId?: string;

    @ApiPropertyOptional({ enum: DevicePlatform, description: 'Filter by platform' })
    @IsOptional()
    @IsEnum(DevicePlatform)
    platform?: DevicePlatform;
}
