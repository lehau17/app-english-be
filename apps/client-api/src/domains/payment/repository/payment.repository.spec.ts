import { PaymentStatus } from '@prisma/client';
import { PaymentRepository } from './payment.repository';

// Mock PrismaRepository
jest.mock('@app/database', () => ({
  PrismaRepository: class {
    transaction: any;
    classroomStudent: any;
  },
}));

describe('PaymentRepository', () => {
  let repository: PaymentRepository;
  let mockTransactionModel: any;
  let mockClassroomStudentModel: any;

  beforeEach(() => {
    mockTransactionModel = {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    };

    mockClassroomStudentModel = {
      update: jest.fn(),
      findUnique: jest.fn(),
    };

    repository = new PaymentRepository();
    // Inject mock models
    (repository as any).transaction = mockTransactionModel;
    (repository as any).classroomStudent = mockClassroomStudentModel;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTransaction', () => {
    it('should create a new transaction', async () => {
      const transactionData = {
        amount: 299000,
        currency: 'VND',
        type: 'course_purchase' as any,
        provider: 'vnpay' as any,
        status: PaymentStatus.pending,
        vnpayTxnRef: 'ORDER_20250101_001',
        student: { connect: { id: 'student-123' } },
        course: { connect: { id: 'course-456' } },
        classroom: { connect: { id: 'classroom-789' } },
        description: 'Test payment',
        ipAddress: '127.0.0.1',
      };

      const expectedTransaction = {
        id: 'txn-123',
        ...transactionData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTransactionModel.create.mockResolvedValue(expectedTransaction);

      const result = await repository.createTransaction(transactionData as any);

      expect(result).toEqual(expectedTransaction);
      expect(mockTransactionModel.create).toHaveBeenCalledWith({
        data: transactionData,
      });
    });
  });

  describe('findTransactionByTxnRef', () => {
    it('should find a transaction by vnpayTxnRef', async () => {
      const vnpayTxnRef = 'ORDER_20250101_001';
      const expectedTransaction = {
        id: 'txn-123',
        vnpayTxnRef,
        amount: 299000,
        student: { id: 'student-123', email: 'student@test.com' },
        course: { id: 'course-456', title: 'Test Course' },
        classroom: { id: 'classroom-789', name: 'Test Classroom' },
      };

      mockTransactionModel.findFirst.mockResolvedValue(expectedTransaction);

      const result = await repository.findTransactionByTxnRef(vnpayTxnRef);

      expect(result).toEqual(expectedTransaction);
      expect(mockTransactionModel.findFirst).toHaveBeenCalledWith({
        where: { vnpayTxnRef },
        include: {
          student: true,
          course: true,
          classroom: true,
        },
      });
    });

    it('should return null if transaction not found', async () => {
      const vnpayTxnRef = 'ORDER_NOTFOUND';
      mockTransactionModel.findFirst.mockResolvedValue(null);

      const result = await repository.findTransactionByTxnRef(vnpayTxnRef);

      expect(result).toBeNull();
    });
  });

  describe('findTransactionById', () => {
    it('should find a transaction by id', async () => {
      const transactionId = 'txn-123';
      const expectedTransaction = {
        id: transactionId,
        vnpayTxnRef: 'ORDER_20250101_001',
        amount: 299000,
        student: { id: 'student-123' },
        course: { id: 'course-456' },
        classroom: { id: 'classroom-789' },
      };

      mockTransactionModel.findUnique.mockResolvedValue(expectedTransaction);

      const result = await repository.findTransactionById(transactionId);

      expect(result).toEqual(expectedTransaction);
      expect(mockTransactionModel.findUnique).toHaveBeenCalledWith({
        where: { id: transactionId },
        include: {
          student: true,
          course: true,
          classroom: true,
        },
      });
    });

    it('should return null if transaction not found', async () => {
      mockTransactionModel.findUnique.mockResolvedValue(null);

      const result = await repository.findTransactionById('txn-notfound');

      expect(result).toBeNull();
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status to success with completedAt', async () => {
      const transactionId = 'txn-123';
      const status = PaymentStatus.success;
      const additionalData = {
        vnpayTransactionNo: 'VNP123456',
        vnpayResponseCode: '00',
        vnpaySecureHash: 'hash123',
        responseData: { vnp_TxnRef: 'ORDER_20250101_001' },
      };

      const updatedTransaction = {
        id: transactionId,
        status,
        ...additionalData,
        completedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };

      mockTransactionModel.update.mockResolvedValue(updatedTransaction);

      const result = await repository.updateTransactionStatus(
        transactionId,
        status,
        additionalData,
      );

      expect(result).toEqual(updatedTransaction);
      expect(mockTransactionModel.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: {
          status,
          ...additionalData,
          updatedAt: expect.any(Date),
          completedAt: expect.any(Date),
        },
      });
    });

    it('should update transaction status to failed without completedAt', async () => {
      const transactionId = 'txn-123';
      const status = PaymentStatus.failed;

      const updatedTransaction = {
        id: transactionId,
        status,
        updatedAt: expect.any(Date),
      };

      mockTransactionModel.update.mockResolvedValue(updatedTransaction);

      const result = await repository.updateTransactionStatus(transactionId, status);

      expect(result).toEqual(updatedTransaction);
      expect(mockTransactionModel.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: {
          status,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should update transaction status to cancelled', async () => {
      const transactionId = 'txn-123';
      const status = PaymentStatus.cancelled;

      mockTransactionModel.update.mockResolvedValue({
        id: transactionId,
        status,
      });

      await repository.updateTransactionStatus(transactionId, status);

      expect(mockTransactionModel.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: {
          status,
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('getStudentTransactions', () => {
    it('should get student transactions without cursor', async () => {
      const studentId = 'student-123';
      const transactions = [
        { id: 'txn-1', amount: 100000, course: {}, classroom: {} },
        { id: 'txn-2', amount: 200000, course: {}, classroom: {} },
      ];

      mockTransactionModel.findMany.mockResolvedValue(transactions);

      const result = await repository.getStudentTransactions(studentId, 10);

      expect(result).toEqual(transactions);
      expect(mockTransactionModel.findMany).toHaveBeenCalledWith({
        where: { studentId },
        include: {
          course: true,
          classroom: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });

    it('should get student transactions with cursor', async () => {
      const studentId = 'student-123';
      const cursor = 'txn-1';
      const transactions = [
        { id: 'txn-2', amount: 200000, course: {}, classroom: {} },
        { id: 'txn-3', amount: 300000, course: {}, classroom: {} },
      ];

      mockTransactionModel.findMany.mockResolvedValue(transactions);

      const result = await repository.getStudentTransactions(studentId, 5, cursor);

      expect(result).toEqual(transactions);
      expect(mockTransactionModel.findMany).toHaveBeenCalledWith({
        where: { studentId },
        include: {
          course: true,
          classroom: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        cursor: { id: cursor },
        skip: 1,
      });
    });
  });

  describe('checkDuplicateTransaction', () => {
    it('should find duplicate successful transaction', async () => {
      const studentId = 'student-123';
      const courseId = 'course-456';
      const classroomId = 'classroom-789';
      const duplicateTransaction = {
        id: 'txn-duplicate',
        studentId,
        courseId,
        classroomId,
        status: PaymentStatus.success,
      };

      mockTransactionModel.findFirst.mockResolvedValue(duplicateTransaction);

      const result = await repository.checkDuplicateTransaction(
        studentId,
        courseId,
        classroomId,
      );

      expect(result).toEqual(duplicateTransaction);
      expect(mockTransactionModel.findFirst).toHaveBeenCalledWith({
        where: {
          studentId,
          courseId,
          classroomId,
          status: PaymentStatus.success,
        },
      });
    });

    it('should return null if no duplicate found', async () => {
      mockTransactionModel.findFirst.mockResolvedValue(null);

      const result = await repository.checkDuplicateTransaction(
        'student-123',
        'course-456',
        'classroom-789',
      );

      expect(result).toBeNull();
    });
  });

  describe('updateStudentPurchaseStatus', () => {
    it('should update student purchase status to true', async () => {
      const studentId = 'student-123';
      const classroomId = 'classroom-789';

      mockClassroomStudentModel.update.mockResolvedValue({
        classroomId,
        studentId,
        isPurchased: true,
      });

      await repository.updateStudentPurchaseStatus(studentId, classroomId, true);

      expect(mockClassroomStudentModel.update).toHaveBeenCalledWith({
        where: {
          classroomId_studentId: {
            classroomId,
            studentId,
          },
        },
        data: { isPurchased: true },
      });
    });

    it('should update student purchase status to false', async () => {
      const studentId = 'student-123';
      const classroomId = 'classroom-789';

      mockClassroomStudentModel.update.mockResolvedValue({
        classroomId,
        studentId,
        isPurchased: false,
      });

      await repository.updateStudentPurchaseStatus(studentId, classroomId, false);

      expect(mockClassroomStudentModel.update).toHaveBeenCalledWith({
        where: {
          classroomId_studentId: {
            classroomId,
            studentId,
          },
        },
        data: { isPurchased: false },
      });
    });
  });

  describe('getStudentPurchaseStatus', () => {
    it('should get student purchase status', async () => {
      const studentId = 'student-123';
      const classroomId = 'classroom-789';

      mockClassroomStudentModel.findUnique.mockResolvedValue({
        isPurchased: true,
      });

      const result = await repository.getStudentPurchaseStatus(studentId, classroomId);

      expect(result).toEqual({ isPurchased: true });
      expect(mockClassroomStudentModel.findUnique).toHaveBeenCalledWith({
        where: {
          classroomId_studentId: {
            classroomId,
            studentId,
          },
        },
        select: { isPurchased: true },
      });
    });

    it('should return null if classroom student not found', async () => {
      const studentId = 'student-123';
      const classroomId = 'classroom-789';

      mockClassroomStudentModel.findUnique.mockResolvedValue(null);

      const result = await repository.getStudentPurchaseStatus(studentId, classroomId);

      expect(result).toBeNull();
    });
  });
});
