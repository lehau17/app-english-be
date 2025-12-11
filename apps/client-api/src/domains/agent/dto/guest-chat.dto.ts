import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateGuestChatDto {
  @ApiProperty({
    description: 'Câu hỏi đầu tiên từ guest user',
    example: 'Khóa học nào phù hợp với người mới bắt đầu?',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiPropertyOptional({
    description: 'UUID từ localStorage để track guest (optional cho lần đầu)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  guestSessionId?: string;
}

export class ContinueGuestChatDto {
  @ApiProperty({
    description: 'ID của conversation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({
    description: 'Câu hỏi tiếp theo',
    example: 'Học phí là bao nhiêu?',
  })
  @IsString()
  @IsNotEmpty()
  question: string;
}

export class GetGuestChatHistoryDto {
  @ApiProperty({
    description: 'UUID từ localStorage để lấy lịch sử chat',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  guestSessionId: string;
}
