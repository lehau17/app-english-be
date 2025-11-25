import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreatePaymentWithTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT token đã verify từ email',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    required: false,
    example: 'https://example.com/payment/return',
    description: 'URL callback sau khi thanh toán',
  })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;
}
