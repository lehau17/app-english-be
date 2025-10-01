import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as qs from 'qs';

export interface VNPayPaymentParams {
  amount: number;
  orderId: string;
  description: string;
  returnUrl?: string;
  ipAddress?: string;
}

export interface VNPayReturnData {
  vnp_TxnRef: string;
  vnp_Amount: string;
  vnp_TmnCode: string;
  vnp_ResponseCode: string;
  vnp_TransactionNo?: string;
  vnp_BankCode?: string;
  vnp_PayDate?: string;
  vnp_SecureHash: string;
  vnp_OrderInfo?: string;
  vnp_TransactionStatus?: string;
}

@Injectable()
export class VNPayService {
  private readonly logger = new Logger(VNPayService.name);

  private readonly tmnCode: string;
  private readonly hashSecret: string;
  private readonly paymentUrl: string;
  private readonly returnUrl: string;

  constructor(private configService: ConfigService) {
    this.tmnCode = this.configService.get('VNPAY_TMN_CODE', 'demo_tmn');
    this.hashSecret = this.configService.get(
      'VNPAY_HASH_SECRET',
      'demo_secret',
    );
    this.paymentUrl = this.configService.get(
      'VNPAY_PAYMENT_URL',
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    );
    this.returnUrl = this.configService.get(
      'VNPAY_RETURN_URL',
      'https://app.haudev.io.vn/payment/return',
    );

    // Debug logging
    this.logger.debug(`VNPay Config - TMN_CODE: ${this.tmnCode}`);
    this.logger.debug(
      `VNPay Config - HASH_SECRET: ${this.hashSecret.substring(0, 8)}...`,
    );
    this.logger.debug(`VNPay Config - RETURN_URL: ${this.returnUrl}`);
  }

  /**
   * Tạo URL thanh toán VNPay
   */
  createPaymentUrl(params: VNPayPaymentParams): string {
    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Amount: (params.amount * 100).toString(),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.orderId,
      vnp_OrderInfo: params.description,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: params.returnUrl || this.returnUrl,
      vnp_IpAddr: this.normalizeIpAddress(params.ipAddress) || '127.0.0.1',
      vnp_CreateDate: this.formatDate(new Date(), 'YYYYMMDDHHmmss'),
    };

    const sortedParams = this.sortObject(vnpParams);
    const signData = qs.stringify(sortedParams, { encode: false });
    const secureHash = this.createSecureHash(signData).toUpperCase();

    this.logger.debug(`Sign data: ${signData}`);
    this.logger.debug(`Secret: ${this.hashSecret}`);
    this.logger.debug(`Generated hash: ${secureHash}`);

    const payloadWithHash = {
      ...sortedParams,
      vnp_SecureHash: secureHash,
      vnp_SecureHashType: 'HmacSHA512',
    };

    const finalQueryString = qs.stringify(payloadWithHash, { encode: false });
    const finalUrl = `${this.paymentUrl}?${finalQueryString}`;

    this.logger.log(`Created VNPay payment URL for order: ${params.orderId}`);
    return finalUrl;
  }

  /**
   * Xác thực callback từ VNPay
   */
  verifyReturnData(
    returnData: VNPayReturnData & { vnp_SecureHashType?: string },
  ): boolean {
    const { vnp_SecureHash, vnp_SecureHashType, ...paramsToVerify } =
      returnData;

    const sortedParams = this.sortObject(
      paramsToVerify as Record<string, string>,
    );
    const signData = qs.stringify(sortedParams, { encode: false });
    const calculatedHash = this.createSecureHash(signData).toUpperCase();

    const isValid = calculatedHash === (vnp_SecureHash?.toUpperCase() || '');

    this.logger.log(
      `VNPay return data verification: ${isValid ? 'SUCCESS' : 'FAILED'} for ${returnData.vnp_TxnRef}`,
    );

    return isValid;
  }

  /**
   * Kiểm tra trạng thái thanh toán từ response code
   */
  isPaymentSuccess(responseCode: string): boolean {
    return responseCode === '00';
  }

  /**
   * Lấy message từ response code
   */
  getResponseMessage(responseCode: string): string {
    const messages: Record<string, string> = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
      '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP). Xin quý khách vui lòng thực hiện lại giao dịch.',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định. Xin quý khách vui lòng thực hiện lại giao dịch',
      '99': 'Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)',
    };

    return messages[responseCode] || `Lỗi không xác định (${responseCode})`;
  }

  /**
   * Tạo secure hash theo thuật toán VNPay (theo code demo chính thức)
   */
  private createSecureHash(queryString: string): string {
    return crypto
      .createHmac('sha512', this.hashSecret)
      .update(Buffer.from(queryString, 'utf-8'))
      .digest('hex');
  }

  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    Object.keys(obj)
      .filter((key) => obj[key] !== undefined && obj[key] !== null)
      .sort()
      .forEach((key) => {
        sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, '+');
      });
    return sorted;
  }

  /**
   * Generate unique order ID
   */
  generateOrderId(): string {
    const timestamp = this.formatDate(new Date(), 'YYYYMMDD_HHmmss');
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `ORDER_${timestamp}_${random}`;
  }

  /**
   * Normalize IP address for VNPay (convert IPv6 to IPv4 if needed)
   */
  private normalizeIpAddress(ipAddress?: string): string {
    if (!ipAddress) return '127.0.0.1';

    // Convert IPv6 loopback to IPv4
    if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
      return '127.0.0.1';
    }

    // Remove IPv6 prefix if present
    if (ipAddress.startsWith('::ffff:')) {
      return ipAddress.substring(7);
    }

    return ipAddress;
  }

  /**
   * Format date to VNPay required format
   */
  private formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year.toString())
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds)
      .replace('_', '_');
  }
}
