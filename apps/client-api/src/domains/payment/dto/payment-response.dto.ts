import { ApiProperty } from '@nestjs/swagger';
import {
  PaymentProvider,
  PaymentStatus,
  TransactionType,
} from '@prisma/client';

export class PaymentResponseData {
  @ApiProperty({
    description: 'ID của transaction',
    example: 'transaction-uuid',
  })
  id: string;

  @ApiProperty({
    description: 'URL thanh toán VNPay',
    example: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...',
  })
  paymentUrl: string;

  @ApiProperty({ description: 'Số tiền thanh toán', example: 500000 })
  amount: number;

  @ApiProperty({ description: 'Mã tiền tệ', example: 'VND' })
  currency: string;

  @ApiProperty({
    description: 'Trạng thái thanh toán',
    enum: PaymentStatus,
    example: PaymentStatus.pending,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: 'Nhà cung cấp thanh toán',
    enum: PaymentProvider,
    example: PaymentProvider.vnpay,
  })
  provider: PaymentProvider;

  @ApiProperty({
    description: 'Loại giao dịch',
    enum: TransactionType,
    example: TransactionType.course_purchase,
  })
  type: TransactionType;

  @ApiProperty({
    description: 'Mã tham chiếu VNPay',
    example: 'ORDER_20241001_123456',
  })
  vnpayTxnRef: string;

  @ApiProperty({
    description: 'Mã giao dịch (transaction id)',
    example: 'transaction-uuid',
  })
  transactionId: string;

  @ApiProperty({ description: 'Mã đơn hàng', example: 'ORDER_20241001_123456' })
  orderId: string;

  @ApiProperty({
    description: 'Thời gian tạo',
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;
}

export class PaymentResponseDto {
  @ApiProperty({ description: 'Mã trạng thái HTTP', example: 201 })
  statusCode: number;

  @ApiProperty({
    description: 'Thông báo phản hồi',
    example: 'Tạo link thanh toán thành công',
  })
  message: string;

  @ApiProperty({ type: PaymentResponseData })
  data: PaymentResponseData;
}
