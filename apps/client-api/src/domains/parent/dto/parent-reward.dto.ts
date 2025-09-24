import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsInt, Min } from 'class-validator';

export enum UiRewardType {
  privilege = 'privilege',
  activity = 'activity',
  item = 'item',
  experience = 'experience',
}

export class CreateParentRewardDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  // UI type, will be mapped to Prisma RewardType
  @ApiProperty({ enum: UiRewardType }) @IsEnum(UiRewardType) type: UiRewardType;
  @ApiPropertyOptional() @IsString() @IsOptional() imageUrl?: string;
  @ApiProperty({ description: 'Target child id' }) @IsUUID() targetChildId: string;
  @ApiPropertyOptional({ description: 'Reward cost (default 0)' }) @IsInt() @Min(0) @IsOptional() cost?: number;
}

export class UpdateParentRewardDto {
  @ApiPropertyOptional() @IsString() @IsOptional() title?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional({ enum: UiRewardType }) @IsEnum(UiRewardType) @IsOptional() type?: UiRewardType;
  @ApiPropertyOptional() @IsString() @IsOptional() imageUrl?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() targetChildId?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() cost?: number;
}

