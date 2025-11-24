import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentProvider,
  PaymentStatus,
  TransactionType,
} from '@prisma/client';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentRepository } from '../repository/payment.repository';
import { VNPayReturnData, VNPayService } from './vnpay.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly vnpayService: VNPayService,
  ) { }

  /**
   * Tạo link thanh toán cho khóa học
   */
  async createPayment(
    studentId: string,
    dto: CreatePaymentDto,
    ipAddress?: string,
    requesterId?: string,
  ) {
    this.logger.log(
      `Creating payment for student ${studentId}, course ${dto.courseId}`,
    );

    // Kiểm tra quyền thanh toán
    if (requesterId && requesterId !== studentId) {
      // Người thanh toán khác với học sinh → phụ huynh thanh toán cho con
      // Cần kiểm tra quan hệ parent-child
      const parentChildRelation =
        await this.paymentRepository.parentChild.findUnique({
          where: {
            parentId_childId: {
              parentId: requesterId,
              childId: studentId,
            },
          },
        });

      if (!parentChildRelation) {
        throw new NotFoundException(
          'Bạn không có quyền thanh toán cho học sinh này',
        );
      }
      
      this.logger.log(
        `Parent ${requesterId} is paying for student ${studentId}`,
      );
    } else {
      // requesterId === studentId hoặc không có requesterId
      // → Học sinh tự thanh toán
      this.logger.log(`Student ${studentId} is paying for themselves`);
    }

    // Kiểm tra khóa học có giá > 0
    const course = await this.paymentRepository.course.findUnique({
      where: { id: dto.courseId },
      select: { id: true, price: true, title: true },
    });

    if (!course) {
      throw new NotFoundException('Khóa học không tồn tại');
    }

    if (!course.price || course.price <= 0) {
      throw new BadRequestException(
        'Khóa học này miễn phí, không cần thanh toán',
      );
    }

    // Kiểm tra học sinh có trong lớp
    const classroomStudent =
      await this.paymentRepository.classroomStudent.findUnique({
        where: {
          classroomId_studentId: {
            classroomId: dto.classroomId,
            studentId,
          },
        },
      });

    if (!classroomStudent) {
      throw new NotFoundException('Bạn chưa tham gia lớp học này');
    }

    if (classroomStudent.isPurchased) {
      throw new ConflictException('Bạn đã thanh toán cho khóa học này rồi');
    }

    // Kiểm tra giao dịch trùng lặp
    const existingTransaction =
      await this.paymentRepository.checkDuplicateTransaction(
        studentId,
        dto.courseId,
        dto.classroomId,
      );

    if (existingTransaction) {
      throw new ConflictException(
        'Bạn đã thanh toán thành công cho khóa học này',
      );
    }

    // Tạo order ID
    const orderId = this.vnpayService.generateOrderId();

    // Tạo transaction record
    const transaction = await this.paymentRepository.createTransaction({
      amount: dto.amount || course.price,
      currency: dto.currency || 'VND',
      type: TransactionType.course_purchase,
      provider: PaymentProvider.vnpay,
      status: PaymentStatus.pending,
      vnpayTxnRef: orderId,
      student: { connect: { id: studentId } },
      course: { connect: { id: dto.courseId } },
      classroom: { connect: { id: dto.classroomId } },
      description: dto.description || `Thanh toán khóa học: ${course.title}`,
      returnUrl: dto.returnUrl,
      ipAddress,
    });

    // Tạo VNPay payment URL
    const paymentUrl = this.vnpayService.createPaymentUrl({
      amount: transaction.amount,
      orderId: transaction.vnpayTxnRef!,
      description: transaction.description || 'Thanh toán khóa học',
      returnUrl: dto.returnUrl,
      ipAddress,
    });

    this.logger.log(
      `Created payment transaction ${transaction.id} for student ${studentId}`,
    );

    return {
      id: transaction.id,
      paymentUrl,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      provider: transaction.provider,
      type: transaction.type,
      transactionId: transaction.id,
      orderId: transaction.vnpayTxnRef!,
      vnpayTxnRef: transaction.vnpayTxnRef!,
      createdAt: transaction.createdAt,
    };
  }

  /**
   * Xử lý callback từ VNPay
   */
  async handleVNPayReturn(returnData: VNPayReturnData): Promise<{
    success: boolean;
    message: string;
    transactionId?: string;
  }> {
    this.logger.log(`Processing VNPay return for ${returnData.vnp_TxnRef}`);

    // Xác thực checksum
    const isValidHash = this.vnpayService.verifyReturnData(returnData);
    if (!isValidHash) {
      this.logger.error(
        `Invalid checksum for transaction ${returnData.vnp_TxnRef}`,
      );
      return {
        success: false,
        message: 'Checksum không hợp lệ',
      };
    }

    // Tìm transaction
    const transaction = await this.paymentRepository.findTransactionByTxnRef(
      returnData.vnp_TxnRef,
    );
    if (!transaction) {
      this.logger.error(`Transaction not found: ${returnData.vnp_TxnRef}`);
      return {
        success: false,
        message: 'Giao dịch không tồn tại',
      };
    }

    // Kiểm tra amount
    const expectedAmount = (transaction.amount * 100).toString(); // VNPay trả về x100
    if (returnData.vnp_Amount !== expectedAmount) {
      this.logger.error(
        `Amount mismatch: expected ${expectedAmount}, got ${returnData.vnp_Amount}`,
      );
      return {
        success: false,
        message: 'Số tiền không khớp',
      };
    }

    // Xử lý theo response code
    const isSuccess = this.vnpayService.isPaymentSuccess(
      returnData.vnp_ResponseCode,
    );
    const message = this.vnpayService.getResponseMessage(
      returnData.vnp_ResponseCode,
    );

    try {
      if (isSuccess) {
        // Thanh toán thành công
        await this.paymentRepository.updateTransactionStatus(
          transaction.id,
          PaymentStatus.success,
          {
            vnpayTransactionNo: returnData.vnp_TransactionNo,
            vnpayResponseCode: returnData.vnp_ResponseCode,
            vnpaySecureHash: returnData.vnp_SecureHash,
            responseData: returnData as any,
          },
        );

        // Cập nhật trạng thái purchase
        await this.paymentRepository.updateStudentPurchaseStatus(
          transaction.studentId,
          transaction.classroomId!,
          true,
        );

        this.logger.log(`Payment successful for transaction ${transaction.id}`);

        return {
          success: true,
          message: 'Thanh toán thành công',
          transactionId: transaction.id,
        };
      } else {
        // Thanh toán thất bại
        let status: PaymentStatus = PaymentStatus.failed;
        if (returnData.vnp_ResponseCode === '24') {
          status = PaymentStatus.cancelled; // User cancelled
        }

        await this.paymentRepository.updateTransactionStatus(
          transaction.id,
          status,
          {
            vnpayTransactionNo: returnData.vnp_TransactionNo,
            vnpayResponseCode: returnData.vnp_ResponseCode,
            vnpaySecureHash: returnData.vnp_SecureHash,
            responseData: returnData as any,
          },
        );

        this.logger.warn(
          `Payment failed for transaction ${transaction.id}: ${message}`,
        );

        return {
          success: false,
          message,
          transactionId: transaction.id,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error processing VNPay return: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: 'Lỗi xử lý giao dịch',
      };
    }
  }

  /**
   * Lấy danh sách giao dịch của học sinh
   */
  async getStudentTransactions(
    studentId: string,
    limit: number = 10,
    cursor?: string,
  ) {
    return this.paymentRepository.getStudentTransactions(
      studentId,
      limit,
      cursor,
    );
  }

  /**
   * Kiểm tra trạng thái thanh toán của học sinh cho lớp học
   */
  async checkStudentPurchaseStatus(studentId: string, classroomId: string) {
    const result = await this.paymentRepository.getStudentPurchaseStatus(
      studentId,
      classroomId,
    );
    return {
      isPurchased: result?.isPurchased || false,
    };
  }

  /**
   * Lấy danh sách toàn bộ giao dịch (Admin)
   */
  async getAllTransactions(
    limit: number = 10,
    cursor?: string,
    filters?: {
      status?: PaymentStatus;
      startDate?: Date;
      endDate?: Date;
      studentId?: string;
    },
  ) {
    return this.paymentRepository.getAllTransactions(limit, cursor, filters);
  }
}
