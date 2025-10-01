import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { VNPayReturnDto } from '../dto/vnpay-return.dto';
import { PaymentService } from '../service/payment.service';

@ApiTags('Payment')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('/create')
  @ApiOperation({ summary: 'Tạo link thanh toán VNPay cho khóa học' })
  @ResponseMessage('Tạo link thanh toán thành công')
  async createPayment(
    @PayloadToken() payload: JwtPayload,
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    // Sử dụng studentId từ DTO nếu có (phụ huynh thanh toán), nếu không dùng payload.sub (học sinh tự thanh toán)
    const studentId = dto.studentId || payload.sub;
    return this.paymentService.createPayment(studentId, dto, ipAddress, payload.sub);
  }

  @Get('/transactions')
  @ApiOperation({ summary: 'Danh sách giao dịch của học sinh' })
  @ResponseMessage('Danh sách giao dịch')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  async getTransactions(
    @PayloadToken() payload: JwtPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.paymentService.getStudentTransactions(payload.sub, parsedLimit, cursor);
  }

  @Get('/purchase-status/:classroomId')
  @ApiOperation({ summary: 'Kiểm tra trạng thái thanh toán cho lớp học' })
  @ResponseMessage('Trạng thái thanh toán')
  async getPurchaseStatus(
    @PayloadToken() payload: JwtPayload,
    @Param('classroomId') classroomId: string,
  ) {
    return this.paymentService.checkStudentPurchaseStatus(payload.sub, classroomId);
  }
}

@ApiTags('Payment Webhook')
@Controller('/public/v1/payment')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Get('/vnpay/return')
  @ApiOperation({ summary: 'VNPay return URL (webhook)' })
  @HttpCode(HttpStatus.OK)
  async handleVNPayReturn(@Query() returnData: VNPayReturnDto) {
    this.logger.log(`VNPay return webhook called for ${returnData.vnp_TxnRef}`);

    const result = await this.paymentService.handleVNPayReturn(returnData);

    // Redirect frontend based on result
    const baseUrl = process.env.VNPAY_RETURN_URL || 'http://localhost:5173/payment/return';
    const redirectUrl = new URL(baseUrl);

    redirectUrl.searchParams.set('success', result.success.toString());
    redirectUrl.searchParams.set('message', encodeURIComponent(result.message));

    if (result.transactionId) {
      redirectUrl.searchParams.set('transactionId', result.transactionId);
    }

    // Return redirect response
    return {
      statusCode: 302,
      message: 'Redirect',
      data: {
        redirectUrl: redirectUrl.toString(),
        success: result.success,
        message: result.message,
      },
    };
  }

  @Post('/vnpay/return')
  @ApiOperation({ summary: 'VNPay IPN (Instant Payment Notification)' })
  @HttpCode(HttpStatus.OK)
  async handleVNPayIPN(@Body() returnData: VNPayReturnDto) {
    this.logger.log(`VNPay IPN called for ${returnData.vnp_TxnRef}`);

    const result = await this.paymentService.handleVNPayReturn(returnData);

    // VNPay expects specific response format for IPN
    if (result.success) {
      return { RspCode: '00', Message: 'Success' };
    } else {
      return { RspCode: '99', Message: result.message };
    }
  }
}
