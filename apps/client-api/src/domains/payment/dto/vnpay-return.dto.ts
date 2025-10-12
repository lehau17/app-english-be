import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VNPayReturnDto {
  @ApiProperty({
    description: 'Mã tham chiếu đơn hàng',
    example: 'ORDER_20241001_123456',
  })
  @IsString()
  @IsNotEmpty()
  vnp_TxnRef: string;

  @ApiProperty({
    description: 'Số tiền thanh toán (VND)',
    example: '50000000', // 500,000 VND * 100
  })
  @IsString()
  @IsNotEmpty()
  vnp_Amount: string;

  @ApiProperty({
    description: 'Mã đơn vị thanh toán',
    example: 'demo_tmn',
  })
  @IsString()
  @IsNotEmpty()
  vnp_TmnCode: string;

  @ApiProperty({
    description: 'Mã phản hồi từ VNPay',
    example: '00',
  })
  @IsString()
  @IsNotEmpty()
  vnp_ResponseCode: string;

  @ApiProperty({
    description: 'Số giao dịch tại VNPay',
    example: '14123456',
  })
  @IsString()
  @IsOptional()
  vnp_TransactionNo?: string;

  @ApiProperty({
    description: 'Mã ngân hàng thanh toán',
    example: 'NCB',
  })
  @IsString()
  @IsOptional()
  vnp_BankCode?: string;

  @ApiProperty({
    description: 'Thời gian thanh toán',
    example: '20241001143000',
  })
  @IsString()
  @IsOptional()
  vnp_PayDate?: string;

  @ApiProperty({
    description: 'Mã checksum bảo mật',
    example: 'hash_string',
  })
  @IsString()
  @IsNotEmpty()
  vnp_SecureHash: string;

  @ApiProperty({
    description: 'Thông tin đơn hàng',
    example: 'Thanh toan khoa hoc',
  })
  @IsString()
  @IsOptional()
  vnp_OrderInfo?: string;

  @ApiProperty({
    description: 'Loại giao dịch',
    example: '02',
  })
  @IsString()
  @IsOptional()
  vnp_TransactionStatus?: string;

  @ApiProperty({
    description: 'Số giao dịch ngân hàng',
    example: 'VNP15199800',
  })
  @IsString()
  @IsOptional()
  vnp_BankTranNo?: string;

  @ApiProperty({
    description: 'Loại thẻ thanh toán',
    example: 'ATM',
  })
  @IsString()
  @IsOptional()
  vnp_CardType?: string;
}
