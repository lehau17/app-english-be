import { ConfigService } from '@nestjs/config';
import { VNPayService } from './vnpay.service';

describe('VNPayService', () => {
  let service: VNPayService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          VNPAY_TMN_CODE: 'test_tmn_code',
          VNPAY_HASH_SECRET: 'test_secret_key',
          VNPAY_PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
          VNPAY_RETURN_URL: 'http://localhost:3000/payment/return',
        };
        return config[key] || defaultValue;
      }),
    } as any;

    service = new VNPayService(configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentUrl', () => {
    it('should create a valid payment URL', () => {
      const params = {
        amount: 100000,
        orderId: 'ORDER_20250101_001',
        description: 'Test payment',
        returnUrl: 'http://localhost:3000/payment/return',
        ipAddress: '127.0.0.1',
      };

      const url = service.createPaymentUrl(params);

      expect(url).toContain('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
      expect(url).toContain('vnp_TxnRef=ORDER_20250101_001');
      expect(url).toContain('vnp_Amount=10000000'); // 100000 * 100
      expect(url).toContain('vnp_TmnCode=test_tmn_code');
      expect(url).toContain('vnp_SecureHash=');
      expect(url).toContain('vnp_OrderInfo=Test+payment');
    });

    it('should use default return URL if not provided', () => {
      const params = {
        amount: 50000,
        orderId: 'ORDER_20250101_002',
        description: 'Another test',
        ipAddress: '192.168.1.1',
      };

      const url = service.createPaymentUrl(params);

      expect(url).toContain('vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A3000%2Fpayment%2Freturn');
    });

    it('should normalize IPv6 address to IPv4', () => {
      const params = {
        amount: 100000,
        orderId: 'ORDER_20250101_003',
        description: 'Test IPv6',
        ipAddress: '::1',
      };

      const url = service.createPaymentUrl(params);

      expect(url).toContain('vnp_IpAddr=127.0.0.1');
    });
  });

  describe('verifyReturnData', () => {
    it('should return true for valid signature', () => {
      const returnData = {
        vnp_TxnRef: 'ORDER_20250101_001',
        vnp_Amount: '10000000',
        vnp_TmnCode: 'test_tmn_code',
        vnp_ResponseCode: '00',
        vnp_SecureHash: 'valid_hash',
      };

      // Mock the verification - in real scenario, this would calculate the actual hash
      jest.spyOn(service as any, 'createSecureHash').mockReturnValue('valid_hash');

      const result = service.verifyReturnData(returnData);

      expect(result).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const returnData = {
        vnp_TxnRef: 'ORDER_20250101_001',
        vnp_Amount: '10000000',
        vnp_TmnCode: 'test_tmn_code',
        vnp_ResponseCode: '00',
        vnp_SecureHash: 'invalid_hash',
      };

      jest.spyOn(service as any, 'createSecureHash').mockReturnValue('valid_hash');

      const result = service.verifyReturnData(returnData);

      expect(result).toBe(false);
    });
  });

  describe('isPaymentSuccess', () => {
    it('should return true for success response code', () => {
      expect(service.isPaymentSuccess('00')).toBe(true);
    });

    it('should return false for non-success response codes', () => {
      expect(service.isPaymentSuccess('07')).toBe(false);
      expect(service.isPaymentSuccess('09')).toBe(false);
      expect(service.isPaymentSuccess('24')).toBe(false);
      expect(service.isPaymentSuccess('99')).toBe(false);
    });
  });

  describe('getResponseMessage', () => {
    it('should return correct message for success code', () => {
      const message = service.getResponseMessage('00');
      expect(message).toBe('Giao dịch thành công');
    });

    it('should return correct message for user cancelled', () => {
      const message = service.getResponseMessage('24');
      expect(message).toBe('Giao dịch không thành công do: Khách hàng hủy giao dịch');
    });

    it('should return correct message for insufficient funds', () => {
      const message = service.getResponseMessage('51');
      expect(message).toBe('Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.');
    });

    it('should return unknown error message for undefined codes', () => {
      const message = service.getResponseMessage('999');
      expect(message).toContain('Lỗi không xác định');
      expect(message).toContain('999');
    });
  });

  describe('generateOrderId', () => {
    it('should generate a unique order ID', () => {
      const orderId1 = service.generateOrderId();
      const orderId2 = service.generateOrderId();

      expect(orderId1).toMatch(/^ORDER_\d{8}_\d{6}_\d{3}$/);
      expect(orderId2).toMatch(/^ORDER_\d{8}_\d{6}_\d{3}$/);
      // They should be different due to timestamp/random
      expect(orderId1).not.toBe(orderId2);
    });

    it('should start with ORDER_ prefix', () => {
      const orderId = service.generateOrderId();
      expect(orderId).toMatch(/^ORDER_/);
    });
  });
});
