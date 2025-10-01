import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FinalizeAiSpeakingSessionDto {
  @ApiPropertyOptional({ description: 'Ghi chú hoặc yêu cầu kết thúc từ phía người học' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Cảm nhận của học viên sau phiên luyện', maxLength: 2000 })
  @IsOptional()
  @IsString()
  learnerReflection?: string;
}
