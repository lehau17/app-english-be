import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentProvider,
  PaymentStatus,
  TransactionType,
} from '@prisma/client';
import { PaymentRepository } from '../repository/payment.repository';
import { PaymentService } from './payment.service';
import { VNPayService } from './vnpay.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: jest.Mocked<PaymentRepository>;
  let vnpayService: jest.Mocked<VNPayService>;

  beforeEach(() => {
    paymentRepository = {
      parentChild: {
        findUnique: jest.fn(),
      },
      course: {
        findUnique: jest.fn(),
      },
      classroomStudent: {
        findUnique: jest.fn(),
      },
      createTransaction: jest.fn(),
      findTransactionByTxnRef: jest.fn(),
      updateTransactionStatus: jest.fn(),
      checkDuplicateTransaction: jest.fn(),
      updateStudentPurchaseStatus: jest.fn(),
      getStudentTransactions: jest.fn(),
      getStudentPurchaseStatus: jest.fn(),
    } as any;

    vnpayService = {
      generateOrderId: jest.fn(),
      createPaymentUrl: jest.fn(),
      verifyReturnData: jest.fn(),
      isPaymentSuccess: jest.fn(),
      getResponseMessage: jest.fn(),
    } as any;

    service = new PaymentService(paymentRepository, vnpayService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    const studentId = 'student-123';
    const createPaymentDto = {
      courseId: 'course-456',
      classroomId: 'classroom-789',
      amount: 299000,
      currency: 'VND',
      description: 'Test payment',
      returnUrl: 'http://localhost:3000/return',
    };

    it('should create payment successfully', async () => {
      const course = { id: 'course-456', price: 299000, title: 'Test Course' };
      const classroomStudent = { isPurchased: false };
      const orderId = 'ORDER_20250101_001';
      const transaction = {
        id: 'txn-123',
        amount: 299000,
        currency: 'VND',
        status: PaymentStatus.pending,
        provider: PaymentProvider.vnpay,
        type: TransactionType.course_purchase,
        vnpayTxnRef: orderId,
        description: 'Test payment',
        createdAt: new Date(),
      };
      const paymentUrl =
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=ORDER_20250101_001';

      paymentRepository.course.findUnique.mockResolvedValue(course as any);
      paymentRepository.classroomStudent.findUnique.mockResolvedValue(
        classroomStudent as any,
      );
      paymentRepository.checkDuplicateTransaction.mockResolvedValue(null);
      vnpayService.generateOrderId.mockReturnValue(orderId);
      paymentRepository.createTransaction.mockResolvedValue(transaction as any);
      vnpayService.createPaymentUrl.mockReturnValue(paymentUrl);

      const result = await service.createPayment(
        studentId,
        createPaymentDto,
        '127.0.0.1',
      );

      expect(result).toMatchObject({
        id: 'txn-123',
        paymentUrl,
        amount: 299000,
        currency: 'VND',
        status: PaymentStatus.pending,
        orderId,
      });
      expect(paymentRepository.createTransaction).toHaveBeenCalled();
      expect(vnpayService.createPaymentUrl).toHaveBeenCalled();
    });

    it('should throw NotFoundException if course does not exist', async () => {
      paymentRepository.course.findUnique.mockResolvedValue(null);

      await expect(
        service.createPayment(studentId, createPaymentDto, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createPayment(studentId, createPaymentDto, '127.0.0.1'),
      ).rejects.toThrow('Khóa học không tồn tại');
    });

    it('should throw BadRequestException if course is free', async () => {
      const freeCourse = { id: 'course-456', price: 0, title: 'Free Course' };
      paymentRepository.course.findUnique.mockResolvedValue(freeCourse as any);

      await expect(
        service.createPayment(studentId, createPaymentDto, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createPayment(studentId, createPaymentDto, '127.0.0.1'),
      ).rejects.toThrow('Khóa học này miễn phí, không cần thanh toán');
    });

    it('should throw NotFoundException if student not in classroom', async () => {
      const course = { id: 'course-456', price: 299000, title: 'Test Course' };
      paymentRepository.course.findUnique.mockResolvedValue(course as any);
      paymentRepository.classroomStudent.findUnique.mockResolvedValue(null);

      await expect(
        service.createPayment(studentId, createPaymentDto, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createPayment(studentId, createPaymentDto, '127.0.0.1'),
      ).rejects.toThrow('Bạn chưa tham gia lớp học này');
    });

    it('should throw ConflictException if student already purchased', async () => {
      const course = { id: 'course-456', price: 299000, title: 'Test Course' };
      const classroomStudent = { isPurchased: true };
      paymentRepository.course.findUnique.mockResolvedValue(course as any);
      paymentRepository.classroomStudent.findUnique.mockResolvedValue(
        classroomStudent as any,
      );

      await expect(
        service.createPayment(studentId, createPaymentDto, '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createPayment(studentId, createPaymentDto, '127.0.0.1'),
      ).rejects.toThrow('Bạn đã thanh toán cho khóa học này rồi');
    });

    it('should throw ConflictException if duplicate transaction exists', async () => {
      const course = { id: 'course-456', price: 299000, title: 'Test Course' };
      const classroomStudent = { isPurchased: false };
      const existingTransaction = {
        id: 'existing-txn',
        status: PaymentStatus.success,
      };

      paymentRepository.course.findUnique.mockResolvedValue(course as any);
      paymentRepository.classroomStudent.findUnique.mockResolvedValue(
        classroomStudent as any,
      );
      paymentRepository.checkDuplicateTransaction.mockResolvedValue(
        existingTransaction as any,
      );

      await expect(
        service.createPayment(studentId, createPaymentDto, '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createPayment(studentId, createPaymentDto, '127.0.0.1'),
      ).rejects.toThrow('Bạn đã thanh toán thành công cho khóa học này');
    });

    it('should validate parent-child relationship when studentId in DTO', async () => {
      const dtoWithStudent = {
        ...createPaymentDto,
        studentId: 'child-123',
      };
      const parentId = 'parent-456';

      paymentRepository.parentChild.findUnique.mockResolvedValue({
        parentId,
        childId: 'child-123',
      } as any);
      const course = { id: 'course-456', price: 299000, title: 'Test Course' };
      const classroomStudent = { isPurchased: false };
      const orderId = 'ORDER_20250101_002';

      paymentRepository.course.findUnique.mockResolvedValue(course as any);
      paymentRepository.classroomStudent.findUnique.mockResolvedValue(
        classroomStudent as any,
      );
      paymentRepository.checkDuplicateTransaction.mockResolvedValue(null);
      vnpayService.generateOrderId.mockReturnValue(orderId);
      paymentRepository.createTransaction.mockResolvedValue({
        id: 'txn-456',
        vnpayTxnRef: orderId,
      } as any);
      vnpayService.createPaymentUrl.mockReturnValue('http://payment.url');

      await service.createPayment(
        'child-123',
        dtoWithStudent,
        '127.0.0.1',
        parentId,
      );

      expect(paymentRepository.parentChild.findUnique).toHaveBeenCalledWith({
        where: {
          parentId_childId: {
            parentId,
            childId: 'child-123',
          },
        },
      });
    });

    it('should throw NotFoundException if parent has no relation to child', async () => {
      const dtoWithStudent = {
        ...createPaymentDto,
        studentId: 'child-123',
      };
      const parentId = 'parent-456';

      paymentRepository.parentChild.findUnique.mockResolvedValue(null);

      await expect(
        service.createPayment(
          'child-123',
          dtoWithStudent,
          '127.0.0.1',
          parentId,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createPayment(
          'child-123',
          dtoWithStudent,
          '127.0.0.1',
          parentId,
        ),
      ).rejects.toThrow('Bạn không có quyền thanh toán cho học sinh này');
    });
  });

  describe('handleVNPayReturn', () => {
    const returnData = {
      vnp_TxnRef: 'ORDER_20250101_001',
      vnp_Amount: '29900000', // 299000 * 100
      vnp_TmnCode: 'test_tmn',
      vnp_ResponseCode: '00',
      vnp_TransactionNo: 'VNP123456',
      vnp_SecureHash: 'valid_hash',
    };

    const transaction = {
      id: 'txn-123',
      amount: 299000,
      studentId: 'student-123',
      classroomId: 'classroom-789',
      status: PaymentStatus.pending,
    };

    it('should handle successful payment', async () => {
      vnpayService.verifyReturnData.mockReturnValue(true);
      paymentRepository.findTransactionByTxnRef.mockResolvedValue(
        transaction as any,
      );
      vnpayService.isPaymentSuccess.mockReturnValue(true);
      vnpayService.getResponseMessage.mockReturnValue('Giao dịch thành công');
      paymentRepository.updateTransactionStatus.mockResolvedValue({} as any);
      paymentRepository.updateStudentPurchaseStatus.mockResolvedValue();

      const result = await service.handleVNPayReturn(returnData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Thanh toán thành công');
      expect(result.transactionId).toBe('txn-123');
      expect(paymentRepository.updateTransactionStatus).toHaveBeenCalledWith(
        'txn-123',
        PaymentStatus.success,
        expect.any(Object),
      );
      expect(
        paymentRepository.updateStudentPurchaseStatus,
      ).toHaveBeenCalledWith('student-123', 'classroom-789', true);
    });

    it('should return error for invalid checksum', async () => {
      vnpayService.verifyReturnData.mockReturnValue(false);

      const result = await service.handleVNPayReturn(returnData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Checksum không hợp lệ');
      expect(paymentRepository.updateTransactionStatus).not.toHaveBeenCalled();
    });

    it('should return error if transaction not found', async () => {
      vnpayService.verifyReturnData.mockReturnValue(true);
      paymentRepository.findTransactionByTxnRef.mockResolvedValue(null);

      const result = await service.handleVNPayReturn(returnData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Giao dịch không tồn tại');
      expect(paymentRepository.updateTransactionStatus).not.toHaveBeenCalled();
    });

    it('should return error if amount mismatch', async () => {
      const wrongAmountData = { ...returnData, vnp_Amount: '10000000' };
      vnpayService.verifyReturnData.mockReturnValue(true);
      paymentRepository.findTransactionByTxnRef.mockResolvedValue(
        transaction as any,
      );

      const result = await service.handleVNPayReturn(wrongAmountData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Số tiền không khớp');
      expect(paymentRepository.updateTransactionStatus).not.toHaveBeenCalled();
    });

    it('should handle failed payment', async () => {
      const failedReturnData = { ...returnData, vnp_ResponseCode: '51' };
      vnpayService.verifyReturnData.mockReturnValue(true);
      paymentRepository.findTransactionByTxnRef.mockResolvedValue(
        transaction as any,
      );
      vnpayService.isPaymentSuccess.mockReturnValue(false);
      vnpayService.getResponseMessage.mockReturnValue('Insufficient funds');
      paymentRepository.updateTransactionStatus.mockResolvedValue({} as any);

      const result = await service.handleVNPayReturn(failedReturnData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Insufficient funds');
      expect(result.transactionId).toBe('txn-123');
      expect(paymentRepository.updateTransactionStatus).toHaveBeenCalledWith(
        'txn-123',
        PaymentStatus.failed,
        expect.any(Object),
      );
      expect(
        paymentRepository.updateStudentPurchaseStatus,
      ).not.toHaveBeenCalled();
    });

    it('should mark transaction as cancelled when user cancels', async () => {
      const cancelledReturnData = { ...returnData, vnp_ResponseCode: '24' };
      vnpayService.verifyReturnData.mockReturnValue(true);
      paymentRepository.findTransactionByTxnRef.mockResolvedValue(
        transaction as any,
      );
      vnpayService.isPaymentSuccess.mockReturnValue(false);
      vnpayService.getResponseMessage.mockReturnValue('User cancelled');
      paymentRepository.updateTransactionStatus.mockResolvedValue({} as any);

      const result = await service.handleVNPayReturn(cancelledReturnData);

      expect(result.success).toBe(false);
      expect(paymentRepository.updateTransactionStatus).toHaveBeenCalledWith(
        'txn-123',
        PaymentStatus.cancelled,
        expect.any(Object),
      );
    });

    it('should handle errors during processing', async () => {
      vnpayService.verifyReturnData.mockReturnValue(true);
      paymentRepository.findTransactionByTxnRef.mockResolvedValue(
        transaction as any,
      );
      vnpayService.isPaymentSuccess.mockReturnValue(true);
      paymentRepository.updateTransactionStatus.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.handleVNPayReturn(returnData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Lỗi xử lý giao dịch');
    });
  });

  describe('getStudentTransactions', () => {
    it('should get student transactions with default limit', async () => {
      const studentId = 'student-123';
      const transactions = [
        { id: 'txn-1', amount: 100000 },
        { id: 'txn-2', amount: 200000 },
      ];

      paymentRepository.getStudentTransactions.mockResolvedValue(
        transactions as any,
      );

      const result = await service.getStudentTransactions(studentId);

      expect(result).toEqual(transactions);
      expect(paymentRepository.getStudentTransactions).toHaveBeenCalledWith(
        studentId,
        10,
        undefined,
      );
    });

    it('should get student transactions with custom limit and cursor', async () => {
      const studentId = 'student-123';
      const transactions = [{ id: 'txn-3', amount: 300000 }];

      paymentRepository.getStudentTransactions.mockResolvedValue(
        transactions as any,
      );

      const result = await service.getStudentTransactions(
        studentId,
        5,
        'cursor-123',
      );

      expect(result).toEqual(transactions);
      expect(paymentRepository.getStudentTransactions).toHaveBeenCalledWith(
        studentId,
        5,
        'cursor-123',
      );
    });
  });

  describe('checkStudentPurchaseStatus', () => {
    it('should return isPurchased true when student has purchased', async () => {
      const studentId = 'student-123';
      const classroomId = 'classroom-789';

      paymentRepository.getStudentPurchaseStatus.mockResolvedValue({
        isPurchased: true,
      } as any);

      const result = await service.checkStudentPurchaseStatus(
        studentId,
        classroomId,
      );

      expect(result.isPurchased).toBe(true);
      expect(paymentRepository.getStudentPurchaseStatus).toHaveBeenCalledWith(
        studentId,
        classroomId,
      );
    });

    it('should return isPurchased false when student has not purchased', async () => {
      const studentId = 'student-123';
      const classroomId = 'classroom-789';

      paymentRepository.getStudentPurchaseStatus.mockResolvedValue({
        isPurchased: false,
      } as any);

      const result = await service.checkStudentPurchaseStatus(
        studentId,
        classroomId,
      );

      expect(result.isPurchased).toBe(false);
    });

    it('should return isPurchased false when no record found', async () => {
      const studentId = 'student-123';
      const classroomId = 'classroom-789';

      paymentRepository.getStudentPurchaseStatus.mockResolvedValue(null);

      const result = await service.checkStudentPurchaseStatus(
        studentId,
        classroomId,
      );

      expect(result.isPurchased).toBe(false);
    });
  });
});
