import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DifficultyLevel } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class StartAiSpeakingSessionDto {
  @ApiProperty({
    description: 'ID của cuộc hội thoại (để nhóm các session)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiProperty({
    description: 'Chủ đề cuộc trò chuyện',
    example: 'Giới thiệu bản thân',
  })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiPropertyOptional({ description: 'Mục tiêu cụ thể cho buổi luyện' })
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional({
    enum: DifficultyLevel,
    description: 'Độ khó mong muốn, mặc định beginner',
  })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  targetDifficulty?: DifficultyLevel;

  @ApiPropertyOptional({ description: 'Số lượt hội thoại tối đa', default: 8, minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  maxTurns?: number;

  @ApiPropertyOptional({ description: 'Thiết lập tùy chỉnh cho session', type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
