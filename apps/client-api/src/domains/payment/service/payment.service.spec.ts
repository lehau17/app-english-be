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
      updateTransactionStudentId: jest.fn(),
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

  // ========================================
  // NEW TESTS FOR UNIFIED FLOW ROUTING
  // ========================================

  describe('handleEnrollmentByFlowType', () => {
    const mockMetadata = {
      courseId: 'course-123',
      classroomId: 'classroom-456',
      students: [
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '1234567890',
        },
      ],
    };
    const transactionId = 'txn-789';
    const classroomId = 'classroom-456';

    it('should route to enrollExistingUser for existing-user flow', async () => {
      const metadata = {
        ...mockMetadata,
        existingUser: true,
        userId: 'user-123',
      };
      const enrollSpy = jest
        .spyOn(service as any, 'enrollExistingUser')
        .mockResolvedValue(undefined);

      await service['handleEnrollmentByFlowType'](
        'existing-user',
        metadata,
        transactionId,
        classroomId,
      );

      expect(enrollSpy).toHaveBeenCalledWith(
        metadata.userId,
        classroomId,
        metadata,
      );
      enrollSpy.mockRestore();
    });

    it('should route to handleGuestVerifiedEnrollment for guest-verified flow', async () => {
      const metadata = { ...mockMetadata, emailVerified: true };
      const guestSpy = jest
        .spyOn(service as any, 'handleGuestVerifiedEnrollment')
        .mockResolvedValue(undefined);

      await service['handleEnrollmentByFlowType'](
        'guest-verified',
        metadata,
        transactionId,
        classroomId,
      );

      expect(guestSpy).toHaveBeenCalledWith(
        metadata,
        transactionId,
        classroomId,
      );
      guestSpy.mockRestore();
    });

    it('should route to handleLegacyGuestEnrollment for guest-legacy flow', async () => {
      const metadata = { ...mockMetadata, role: 'student' };
      const legacySpy = jest
        .spyOn(service as any, 'handleLegacyGuestEnrollment')
        .mockResolvedValue(undefined);

      await service['handleEnrollmentByFlowType'](
        'guest-legacy',
        metadata,
        transactionId,
        classroomId,
      );

      expect(legacySpy).toHaveBeenCalledWith(
        metadata,
        transactionId,
        classroomId,
      );
      legacySpy.mockRestore();
    });

    it('should log error for unknown flow type', async () => {
      const metadata = { ...mockMetadata };
      const loggerSpy = jest.spyOn(service['logger'], 'warn');

      await service['handleEnrollmentByFlowType'](
        'unknown' as any,
        metadata,
        transactionId,
        classroomId,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown enrollment flow type'),
      );
    });
  });

  describe('enrollExistingUser', () => {
    const userId = 'user-123';
    const classroomId = 'classroom-456';
    const metadata = {
      courseId: 'course-123',
      classroomId,
      userId,
      existingUser: true,
    };

    it('should UPSERT ClassroomStudent for existing user', async () => {
      paymentRepository.updateStudentPurchaseStatus.mockResolvedValue(
        undefined,
      );

      await service['enrollExistingUser'](userId, classroomId, metadata);

      expect(
        paymentRepository.updateStudentPurchaseStatus,
      ).toHaveBeenCalledWith(userId, classroomId, true);
    });

    it('should send enrollment confirmation email', async () => {
      paymentRepository.updateStudentPurchaseStatus.mockResolvedValue(
        undefined,
      );
      const emailSpy = jest
        .spyOn(service as any, 'sendEnrollmentConfirmationEmail')
        .mockResolvedValue(undefined);

      await service['enrollExistingUser'](userId, classroomId, metadata);

      expect(emailSpy).toHaveBeenCalledWith(userId, metadata);
      emailSpy.mockRestore();
    });
  });

  describe('handleGuestVerifiedEnrollment', () => {
    const metadata = {
      courseId: 'course-123',
      classroomId: 'classroom-456',
      emailVerified: true,
      students: [
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '1234567890',
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '0987654321',
        },
      ],
      parent: {
        firstName: 'Bob',
        lastName: 'Doe',
        email: 'bob@example.com',
        phone: '1112223333',
      },
    };
    const transactionId = 'txn-789';
    const classroomId = 'classroom-456';

    beforeEach(() => {
      // Mock prisma.transaction.update for all tests in this suite
      paymentRepository['prisma'] = {
        transaction: {
          update: jest.fn().mockResolvedValue(undefined),
        },
      } as any;
    });

    it('should create users from metadata', async () => {
      const mockUserResult = {
        studentIds: ['user-1', 'user-2'],
        parentId: 'parent-1',
      };
      const createUsersSpy = jest
        .spyOn(service as any, 'createUsersFromMetadata')
        .mockResolvedValue(mockUserResult);
      paymentRepository.updateStudentPurchaseStatus.mockResolvedValue(
        undefined,
      );
      const emailSpy = jest
        .spyOn(service as any, 'sendWelcomeEmails')
        .mockResolvedValue(undefined);

      await service['handleGuestVerifiedEnrollment'](
        metadata,
        transactionId,
        classroomId,
      );

      expect(createUsersSpy).toHaveBeenCalledWith(metadata, transactionId);
      createUsersSpy.mockRestore();
      emailSpy.mockRestore();
    });

    it('should enroll all students in classroom', async () => {
      const mockUserResult = {
        studentIds: ['user-1', 'user-2'],
        parentId: 'parent-1',
      };
      jest
        .spyOn(service as any, 'createUsersFromMetadata')
        .mockResolvedValue(mockUserResult);
      jest
        .spyOn(service as any, 'sendWelcomeEmails')
        .mockResolvedValue(undefined);
      paymentRepository.updateStudentPurchaseStatus.mockResolvedValue(
        undefined,
      );

      await service['handleGuestVerifiedEnrollment'](
        metadata,
        transactionId,
        classroomId,
      );

      // Should enroll 2 students
      expect(
        paymentRepository.updateStudentPurchaseStatus,
      ).toHaveBeenCalledTimes(2);
      expect(
        paymentRepository.updateStudentPurchaseStatus,
      ).toHaveBeenCalledWith('user-1', classroomId, true);
      expect(
        paymentRepository.updateStudentPurchaseStatus,
      ).toHaveBeenCalledWith('user-2', classroomId, true);
    });

    it('should update transaction with first student ID', async () => {
      const mockUserResult = {
        studentIds: ['user-1', 'user-2'],
        parentId: 'parent-1',
      };
      jest
        .spyOn(service as any, 'createUsersFromMetadata')
        .mockResolvedValue(mockUserResult);
      jest
        .spyOn(service as any, 'sendWelcomeEmails')
        .mockResolvedValue(undefined);
      paymentRepository.updateStudentPurchaseStatus.mockResolvedValue(
        undefined,
      );

      await service['handleGuestVerifiedEnrollment'](
        metadata,
        transactionId,
        classroomId,
      );

      expect(
        paymentRepository['prisma'].transaction.update,
      ).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: { studentId: 'user-1' },
      });
    });

    it('should send welcome emails to all users', async () => {
      const mockUserResult = {
        studentIds: ['user-1', 'user-2'],
        parentId: 'parent-1',
      };
      jest
        .spyOn(service as any, 'createUsersFromMetadata')
        .mockResolvedValue(mockUserResult);
      paymentRepository.updateStudentPurchaseStatus.mockResolvedValue(
        undefined,
      );
      const emailSpy = jest
        .spyOn(service as any, 'sendWelcomeEmails')
        .mockResolvedValue(undefined);

      await service['handleGuestVerifiedEnrollment'](
        metadata,
        transactionId,
        classroomId,
      );

      expect(emailSpy).toHaveBeenCalledWith(mockUserResult, metadata);
      emailSpy.mockRestore();
    });
  });

  describe('handleLegacyGuestEnrollment', () => {
    const metadata = {
      courseId: 'course-123',
      classroomId: 'classroom-456',
      role: 'student' as const,
      students: [
        {
          firstName: 'Legacy',
          lastName: 'Student',
          email: 'legacy@example.com',
          phone: '5551234567',
        },
      ],
    };
    const transactionId = 'txn-old-format';
    const classroomId = 'classroom-456';

    it('should handle flat metadata structure using legacy method', async () => {
      const mockUserResult = {
        studentIds: ['legacy-user-1'],
        parentId: undefined,
      };
      const legacyCreateSpy = jest
        .spyOn(service as any, 'createUsersFromEnrollmentMetadata')
        .mockResolvedValue(mockUserResult);
      paymentRepository.updateStudentPurchaseStatus.mockResolvedValue(
        undefined,
      );
      paymentRepository.updateTransactionStudentId.mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'sendWelcomeEmails')
        .mockResolvedValue(undefined);

      await service['handleLegacyGuestEnrollment'](
        metadata,
        transactionId,
        classroomId,
      );

      expect(legacyCreateSpy).toHaveBeenCalledWith(metadata, transactionId);
      legacyCreateSpy.mockRestore();
    });

    it('should enroll legacy users in classroom', async () => {
      const mockUserResult = {
        studentIds: ['legacy-user-1'],
        parentId: undefined,
      };
      jest
        .spyOn(service as any, 'createUsersFromEnrollmentMetadata')
        .mockResolvedValue(mockUserResult);
      paymentRepository.updateTransactionStudentId.mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'sendWelcomeEmails')
        .mockResolvedValue(undefined);
      paymentRepository.updateStudentPurchaseStatus.mockResolvedValue(
        undefined,
      );

      await service['handleLegacyGuestEnrollment'](
        metadata,
        transactionId,
        classroomId,
      );

      expect(
        paymentRepository.updateStudentPurchaseStatus,
      ).toHaveBeenCalledWith('legacy-user-1', classroomId, true);
    });
  });

  describe('createUsersFromMetadata', () => {
    const transactionId = 'txn-create-users';

    it('should create student users with firstName/lastName structure', async () => {
      const metadata = {
        courseId: 'course-123',
        classroomId: 'classroom-456',
        students: [
          {
            firstName: 'Alice',
            lastName: 'Wonder',
            email: 'alice@example.com',
            phone: '1231231234',
          },
          {
            firstName: 'Bob',
            lastName: 'Builder',
            email: 'bob@example.com',
            phone: '3213213210',
          },
        ],
      };

      const mockTx = {
        user: {
          create: jest
            .fn()
            .mockResolvedValueOnce({ id: 'student-alice' })
            .mockResolvedValueOnce({ id: 'student-bob' }),
          findUnique: jest.fn().mockResolvedValue(null),
        },
        parentChild: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      paymentRepository['prisma'] = {
        $transaction: jest.fn((callback) => callback(mockTx)),
      } as any;

      const result = await service['createUsersFromMetadata'](
        metadata,
        transactionId,
      );

      expect(result.studentIds).toEqual(['student-alice', 'student-bob']);
      expect(mockTx.user.create).toHaveBeenCalledTimes(2);
      expect(mockTx.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          displayName: 'Alice Wonder',
          firstName: 'Alice',
          lastName: 'Wonder',
          email: 'alice@example.com',
          phone: '1231231234',
          role: 'student',
        }),
      });
    });

    it('should create parent user when parent metadata exists', async () => {
      const metadata = {
        courseId: 'course-123',
        classroomId: 'classroom-456',
        role: 'parent' as const,
        students: [
          {
            firstName: 'Child',
            lastName: 'One',
            email: 'child@example.com',
            phone: '1111111111',
          },
        ],
        parent: {
          firstName: 'Parent',
          lastName: 'Guardian',
          email: 'parent@example.com',
          phone: '2222222222',
        },
      };

      const mockTx = {
        user: {
          create: jest
            .fn()
            .mockResolvedValueOnce({ id: 'parent-guardian' })
            .mockResolvedValueOnce({ id: 'student-child' }),
          findUnique: jest.fn().mockResolvedValue(null),
        },
        parentChild: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      paymentRepository['prisma'] = {
        $transaction: jest.fn((callback) => callback(mockTx)),
      } as any;

      const result = await service['createUsersFromMetadata'](
        metadata,
        transactionId,
      );

      expect(result.studentIds).toEqual(['student-child']);
      expect(result.parentId).toEqual('parent-guardian');
      expect(mockTx.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          displayName: 'Parent Guardian',
          firstName: 'Parent',
          lastName: 'Guardian',
          role: 'parent',
        }),
      });
    });

    it('should handle source and notes in user creation', async () => {
      const metadata = {
        courseId: 'course-123',
        classroomId: 'classroom-456',
        students: [
          {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            phone: '9999999999',
          },
        ],
        source: 'landing-page',
        note: 'Test enrollment',
      };

      const mockTx = {
        user: {
          create: jest.fn().mockResolvedValue({ id: 'test-user-id' }),
          findUnique: jest.fn().mockResolvedValue(null),
        },
        parentChild: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      paymentRepository['prisma'] = {
        $transaction: jest.fn((callback) => callback(mockTx)),
      } as any;

      await service['createUsersFromMetadata'](metadata, transactionId);

      expect(mockTx.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'landing-page',
          notes: 'Test enrollment',
        }),
      });
    });
  });
});
