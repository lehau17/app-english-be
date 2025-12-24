import { PrismaRepository } from '@app/database';
import { KafkaProducerService, KafkaTopic } from '@app/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  PaymentStatus,
  TransactionType,
} from '@prisma/client';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentRepository } from '../repository/payment.repository';
import {
  EnrollmentFlowType,
  EnrollmentMetadata,
  extractEnrollmentMetadata,
  getEnrollmentFlowType,
} from '../types/enrollment-metadata.type';
import { VNPayReturnData, VNPayService } from './vnpay.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly prisma: PrismaRepository,
    private readonly vnpayService: VNPayService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Tạo link thanh toán cho khóa học
   */
  async createPayment(
    studentId: string | null,
    dto: CreatePaymentDto,
    ipAddress?: string,
    requesterId?: string | null,
  ) {
    this.logger.log(
      `Creating payment${studentId ? ` for student ${studentId}` : ''}, course ${dto.courseId}`,
    );

    // Kiểm tra quyền thanh toán (chỉ khi có studentId)
    if (studentId && requesterId && requesterId !== studentId) {
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

    // Check duplicate payment (chỉ khi có studentId)
    if (studentId) {
      const classroomStudent =
        await this.paymentRepository.classroomStudent.findUnique({
          where: {
            classroomId_studentId: {
              classroomId: dto.classroomId,
              studentId,
            },
          },
        });

      if (classroomStudent?.isPurchased) {
        throw new ConflictException('Bạn đã thanh toán cho khóa học này rồi');
      }
    }

    // Note: Với guest enrollment (studentId = null),
    // User sẽ được tạo SAU khi thanh toán thành công

    // Kiểm tra giao dịch trùng lặp (chỉ khi có studentId)
    if (studentId) {
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
      // Skip student relation if studentId is null (guest enrollment)
      ...(studentId ? { student: { connect: { id: studentId } } } : {}),
      course: { connect: { id: dto.courseId } },
      classroom: { connect: { id: dto.classroomId } },
      description: dto.description || `Thanh toán khóa học: ${course.title}`,
      returnUrl: dto.returnUrl,
      ipAddress,
      // Store enrollment metadata with NESTED structure (TransactionResponseData)
      responseData: (dto as any).enrollmentMetadata
        ? ({ enrollmentMetadata: (dto as any).enrollmentMetadata } as any)
        : null,
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

        // Extract enrollment metadata (supports both nested and legacy flat)
        const metadata = extractEnrollmentMetadata(transaction.responseData);
        const flowType = getEnrollmentFlowType(metadata);

        this.logger.log(
          `Transaction ${transaction.id} - Flow type: ${flowType}`,
        );

        // Route to appropriate handler based on flow type
        if (metadata && flowType !== 'unknown') {
          await this.handleEnrollmentByFlowType(
            flowType,
            metadata,
            transaction.id,
            transaction.classroomId!,
          );
        } else {
          // Fallback: No metadata, try to enroll primary student
          if (transaction.studentId) {
            this.logger.log(
              `No enrollment metadata, enrolling primary student ${transaction.studentId}`,
            );
            await this.paymentRepository.updateStudentPurchaseStatus(
              transaction.studentId,
              transaction.classroomId!,
              true,
            );
          } else {
            this.logger.warn(
              `Transaction ${transaction.id} has no studentId and no enrollment metadata`,
            );
          }
        }

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
   * Parse studentIds from transaction description
   * Format: "... | StudentIDs: uuid1,uuid2,uuid3"
   */
  private parseStudentIdsFromDescription(description: string | null): string[] {
    if (!description) return [];

    const match = description.match(/StudentIDs:\s*([a-f0-9,-]+)/i);
    if (!match || !match[1]) return [];

    return match[1]
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  /**
   * Create Users from enrollment metadata (guest enrollment)
   * Returns created student and parent IDs
   */
  private async createUsersFromEnrollmentMetadata(
    metadata: any,
    transactionId: string,
  ): Promise<{ studentIds: string[]; parentId?: string }> {
    const { role, students, parent, source, supportNotes } = metadata;

    const studentIds: string[] = [];
    let parentId: string | undefined;

    // Import UserRole and Status from Prisma
    const { UserRole, Status } = await import('@prisma/client');

    // Use Prisma transaction from repository (PaymentRepository extends PrismaRepository)
    await this.prisma.$transaction(async (tx) => {
      // Create parent first if role is parent
      if (role === 'parent' && parent) {
        const email = parent.email?.trim().toLowerCase();

        // Check if parent already exists
        const existingParent = await tx.user.findUnique({ where: { email } });

        if (existingParent) {
          if (existingParent.role !== UserRole.parent) {
            throw new ConflictException(
              `Email ${email} đã được sử dụng với vai trò khác`,
            );
          }
          parentId = existingParent.id;
        } else {
          // Create new parent
          const createdParent = await tx.user.create({
            data: {
              email,
              phone: parent.phone || null,
              displayName: parent.name,
              firstName: parent.name.split(' ')[0] || parent.name,
              lastName: parent.name.split(' ').slice(1).join(' ') || '',
              role: UserRole.parent,
              status: Status.active,
            },
          });
          parentId = createdParent.id;
          this.logger.log(`Created parent user: ${parentId} (${email})`);
        }
      }

      // Create all students
      for (const student of students) {
        const email = student.email?.trim().toLowerCase();

        // Check if student already exists
        const existingStudent = await tx.user.findUnique({ where: { email } });

        if (existingStudent) {
          if (existingStudent.role !== UserRole.student) {
            throw new ConflictException(
              `Email ${email} đã được sử dụng với vai trò khác`,
            );
          }
          studentIds.push(existingStudent.id);
        } else {
          // Create new student
          const createdStudent = await tx.user.create({
            data: {
              email,
              phone: student.phone || null,
              displayName: student.name,
              firstName: student.name.split(' ')[0] || student.name,
              lastName: student.name.split(' ').slice(1).join(' ') || '',
              role: UserRole.student,
              status: Status.active,
            },
          });
          studentIds.push(createdStudent.id);
          this.logger.log(
            `Created student user: ${createdStudent.id} (${email})`,
          );
        }

        // Link parent-child if parent exists
        if (parentId) {
          const existing = await tx.parentChild.findUnique({
            where: {
              parentId_childId: {
                parentId,
                childId: studentIds[studentIds.length - 1],
              },
            },
          });

          if (!existing) {
            await tx.parentChild.create({
              data: {
                parentId,
                childId: studentIds[studentIds.length - 1],
              },
            });
            this.logger.log(
              `Linked parent ${parentId} to student ${studentIds[studentIds.length - 1]}`,
            );
          }
        }
      }
    });

    return { studentIds, parentId };
  }

  /**
   * Route enrollment flow based on flow type
   */
  private async handleEnrollmentByFlowType(
    flowType: EnrollmentFlowType,
    metadata: EnrollmentMetadata,
    transactionId: string,
    classroomId: string,
  ): Promise<void> {
    switch (flowType) {
      case 'existing-user':
        // User đã đăng nhập, thanh toán qua app
        this.logger.log(
          `Existing user enrollment for transaction ${transactionId}, userId: ${metadata.userId}`,
        );
        await this.enrollExistingUser(metadata.userId!, classroomId, metadata);
        this.logger.log(
          `Existing user ${metadata.userId} enrolled successfully`,
        );
        break;

      case 'guest-verified':
        // Guest, đã verify email qua landing page
        this.logger.log(
          `Guest verified enrollment for transaction ${transactionId}, creating users...`,
        );
        await this.handleGuestVerifiedEnrollment(
          metadata,
          transactionId,
          classroomId,
        );
        break;

      case 'guest-legacy':
        // Guest, format cũ (backward compatibility)
        this.logger.log(
          `Legacy guest enrollment for transaction ${transactionId}`,
        );
        await this.handleLegacyGuestEnrollment(
          metadata,
          transactionId,
          classroomId,
        );
        break;

      default:
        this.logger.warn(
          `Unknown enrollment flow type for transaction ${transactionId}`,
        );
    }
  }

  /**
   * Handle existing user enrollment (from app)
   */
  private async enrollExistingUser(
    userId: string,
    classroomId: string,
    metadata: EnrollmentMetadata,
  ): Promise<void> {
    // UPSERT ClassroomStudent
    await this.paymentRepository.updateStudentPurchaseStatus(
      userId,
      classroomId,
      true,
    );

    // Send enrollment confirmation email
    await this.sendEnrollmentConfirmationEmail(userId, metadata);

    this.logger.log(
      `Enrolled existing user ${userId} in classroom ${classroomId}`,
    );
  }

  /**
   * Handle guest verified enrollment (from landing page with email verification)
   */
  private async handleGuestVerifiedEnrollment(
    metadata: EnrollmentMetadata,
    transactionId: string,
    classroomId: string,
  ): Promise<void> {
    // Get original transaction
    const originalTransaction =
      await this.paymentRepository.findTransactionById(transactionId);
    if (!originalTransaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    // Create users from metadata
    const createdUserIds = await this.createUsersFromMetadata(
      metadata,
      transactionId,
    );

    const studentsCount = createdUserIds.studentIds.length;
    const pricePerStudent = originalTransaction.amount / studentsCount;

    // If multiple students, create individual transactions for each
    if (studentsCount > 1) {
      this.logger.log(
        `Creating ${studentsCount} individual transactions (${pricePerStudent} each) from batch payment ${transactionId}`,
      );

      for (let i = 0; i < createdUserIds.studentIds.length; i++) {
        const studentId = createdUserIds.studentIds[i];

        // Create individual transaction for each student
        await this.paymentRepository.createTransaction({
          amount: pricePerStudent,
          currency: originalTransaction.currency,
          type: originalTransaction.type,
          provider: originalTransaction.provider,
          status: originalTransaction.status,
          vnpayTxnRef: originalTransaction.vnpayTxnRef,
          vnpayTransactionNo: originalTransaction.vnpayTransactionNo,
          vnpayResponseCode: originalTransaction.vnpayResponseCode,
          student: { connect: { id: studentId } },
          course: { connect: { id: originalTransaction.courseId! } },
          classroom: { connect: { id: originalTransaction.classroomId! } },
          description: `${originalTransaction.description} (Student ${i + 1}/${studentsCount})`,
          returnUrl: originalTransaction.returnUrl,
          ipAddress: originalTransaction.ipAddress,
          responseData: originalTransaction.responseData,
          completedAt: originalTransaction.completedAt,
        });

        this.logger.log(
          `Created transaction for student ${studentId}: ${pricePerStudent}`,
        );
      }

      // Mark original transaction as "split" by updating description
      await this.paymentRepository.transaction.update({
        where: { id: transactionId },
        data: {
          description: `[SPLIT INTO ${studentsCount}] ${originalTransaction.description}`,
        },
      });
    } else {
      // Single student: just update original transaction
      await this.paymentRepository.transaction.update({
        where: { id: transactionId },
        data: { studentId: createdUserIds.studentIds[0] },
      });
      this.logger.log(
        `Updated transaction ${transactionId} with studentId: ${createdUserIds.studentIds[0]}`,
      );
    }

    // Enroll all created students
    this.logger.log(
      `Starting enrollment for ${createdUserIds.studentIds.length} students in classroom ${classroomId}`,
    );
    for (const studentId of createdUserIds.studentIds) {
      this.logger.log(
        `Enrolling studentId=${studentId} in classroomId=${classroomId}`,
      );
      await this.paymentRepository.updateStudentPurchaseStatus(
        studentId,
        classroomId,
        true,
      );
      this.logger.log(`Successfully enrolled studentId=${studentId}`);
    }

    // Send welcome emails
    await this.sendWelcomeEmails(createdUserIds, metadata);

    this.logger.log(
      `Guest verified enrollment successful: created ${createdUserIds.studentIds.length} student(s)${createdUserIds.parentId ? ' and 1 parent' : ''}`,
    );
  }

  /**
   * Handle legacy guest enrollment (backward compatibility)
   */
  private async handleLegacyGuestEnrollment(
    metadata: EnrollmentMetadata,
    transactionId: string,
    classroomId: string,
  ): Promise<void> {
    // Get original transaction
    const originalTransaction =
      await this.paymentRepository.findTransactionById(transactionId);
    if (!originalTransaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    const createdUserIds = await this.createUsersFromEnrollmentMetadata(
      metadata,
      transactionId,
    );

    const studentsCount = createdUserIds.studentIds.length;
    const pricePerStudent = originalTransaction.amount / studentsCount;

    // If multiple students, create individual transactions for each
    if (studentsCount > 1) {
      this.logger.log(
        `Creating ${studentsCount} individual transactions (${pricePerStudent} each) from batch payment ${transactionId}`,
      );

      for (let i = 0; i < createdUserIds.studentIds.length; i++) {
        const studentId = createdUserIds.studentIds[i];

        await this.paymentRepository.createTransaction({
          amount: pricePerStudent,
          currency: originalTransaction.currency,
          type: originalTransaction.type,
          provider: originalTransaction.provider,
          status: originalTransaction.status,
          vnpayTxnRef: originalTransaction.vnpayTxnRef,
          vnpayTransactionNo: originalTransaction.vnpayTransactionNo,
          vnpayResponseCode: originalTransaction.vnpayResponseCode,
          student: { connect: { id: studentId } },
          course: { connect: { id: originalTransaction.courseId! } },
          classroom: { connect: { id: originalTransaction.classroomId! } },
          description: `${originalTransaction.description} (Student ${i + 1}/${studentsCount})`,
          returnUrl: originalTransaction.returnUrl,
          ipAddress: originalTransaction.ipAddress,
          responseData: originalTransaction.responseData,
          completedAt: originalTransaction.completedAt,
        });

        this.logger.log(
          `Created transaction for student ${studentId}: ${pricePerStudent}`,
        );
      }

      await this.paymentRepository.transaction.update({
        where: { id: transactionId },
        data: {
          description: `[SPLIT INTO ${studentsCount}] ${originalTransaction.description}`,
        },
      });
    } else {
      await this.paymentRepository.transaction.update({
        where: { id: transactionId },
        data: { studentId: createdUserIds.studentIds[0] },
      });
      this.logger.log(
        `Updated transaction ${transactionId} with studentId: ${createdUserIds.studentIds[0]}`,
      );
    }

    // Enroll all created students
    for (const studentId of createdUserIds.studentIds) {
      await this.paymentRepository.updateStudentPurchaseStatus(
        studentId,
        classroomId,
        true,
      );
    }

    this.logger.log(
      `Legacy guest enrollment successful: created ${createdUserIds.studentIds.length} student(s)`,
    );
  }

  /**
   * Create Users from metadata (new format with firstName/lastName)
   */
  private async createUsersFromMetadata(
    metadata: EnrollmentMetadata,
    transactionId: string,
  ): Promise<{
    studentIds: string[];
    parentId?: string;
    passwords: Record<string, string>;
  }> {
    const { role, students, parent, source, note } = metadata;

    const studentIds: string[] = [];
    let parentId: string | undefined;
    const passwords: Record<string, string> = {}; // email -> plaintext password
    const bcrypt = await import('bcrypt');

    const { UserRole, Status } = await import('@prisma/client');

    await this.paymentRepository.$transaction(async (tx) => {
      // Create parent first if role is parent
      if (role === 'parent' && parent) {
        const email = parent.email?.trim().toLowerCase();

        const existingParent = await tx.user.findUnique({ where: { email } });

        if (existingParent) {
          if (existingParent.role !== UserRole.parent) {
            throw new ConflictException(
              `Email ${email} đã được sử dụng với vai trò khác`,
            );
          }
          parentId = existingParent.id;
          this.logger.log(
            `Using existing parent user: ${parentId} (${email}) - no credentials will be sent`,
          );
        } else {
          // Generate default password: First8CharsOfEmail@123
          const defaultPassword = `${email.split('@')[0].slice(0, 8)}@123`;
          const hashedPassword = await bcrypt.hash(defaultPassword, 10);

          const createdParent = await tx.user.create({
            data: {
              email,
              phone: parent.phone || null,
              displayName: `${parent.firstName} ${parent.lastName}`.trim(),
              firstName: parent.firstName,
              lastName: parent.lastName,
              role: UserRole.parent,
              status: Status.active,
              passwordHash: hashedPassword,
              provider: 'local',
            },
          });
          parentId = createdParent.id;
          passwords[email] = defaultPassword; // Store plaintext for email
          this.logger.log(
            `Created parent user: ${parentId} (${email}) with password`,
          );
        }
      }

      // Create all students
      for (const student of students || []) {
        const email = student.email?.trim().toLowerCase();

        const existingStudent = await tx.user.findUnique({ where: { email } });

        if (existingStudent) {
          if (existingStudent.role !== UserRole.student) {
            throw new ConflictException(
              `Email ${email} đã được sử dụng với vai trò khác`,
            );
          }
          studentIds.push(existingStudent.id);
          this.logger.log(
            `Using existing student user: ${existingStudent.id} (${email}) - no credentials will be sent`,
          );
        } else {
          // Generate default password: First8CharsOfEmail@123
          const defaultPassword = `${email.split('@')[0].slice(0, 8)}@123`;
          const hashedPassword = await bcrypt.hash(defaultPassword, 10);

          const createdStudent = await tx.user.create({
            data: {
              email,
              phone: student.phone || null,
              displayName: `${student.firstName} ${student.lastName}`.trim(),
              firstName: student.firstName,
              lastName: student.lastName,
              role: UserRole.student,
              status: Status.active,
              passwordHash: hashedPassword,
              provider: 'local',
            },
          });
          studentIds.push(createdStudent.id);
          passwords[email] = defaultPassword; // Store plaintext for email
          this.logger.log(
            `Created student user: ${createdStudent.id} (${email}) with password`,
          );
        }

        // Link parent-child if parent exists
        if (parentId) {
          const existing = await tx.parentChild.findUnique({
            where: {
              parentId_childId: {
                parentId,
                childId: studentIds[studentIds.length - 1],
              },
            },
          });

          if (!existing) {
            await tx.parentChild.create({
              data: {
                parentId,
                childId: studentIds[studentIds.length - 1],
              },
            });
            this.logger.log(
              `Linked parent ${parentId} to student ${studentIds[studentIds.length - 1]}`,
            );
          }
        }
      }
    });

    return { studentIds, parentId, passwords };
  }

  /**
   * Send welcome emails to newly created users
   */
  private async sendWelcomeEmails(
    createdUserIds: {
      studentIds: string[];
      parentId?: string;
      passwords: Record<string, string>;
    },
    metadata: EnrollmentMetadata,
  ): Promise<void> {
    try {
      // Fetch user data
      const allUserIds = [...createdUserIds.studentIds];
      if (createdUserIds.parentId) {
        allUserIds.push(createdUserIds.parentId);
      }

      const users = await this.prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: {
          id: true,
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      // Fetch course and classroom info
      const [course, classroom] = await Promise.all([
        this.prisma.course.findUnique({
          where: { id: metadata.courseId },
          select: { title: true, price: true, currency: true },
        }),
        this.prisma.classroom.findUnique({
          where: { id: metadata.classroomId },
          select: { name: true },
        }),
      ]);

      if (!course || !classroom) {
        this.logger.warn('Course or classroom not found for welcome email');
        return;
      }

      const loginUrl = `${this.configService.get('WEB_APP_URL')}/login`;

      // Send email to each user via Kafka
      for (const user of users) {
        const password = createdUserIds.passwords[user.email] || null;

        await this.kafkaProducer.send(KafkaTopic.EMAIL_WELCOME_NEW_USER, {
          type: 'welcome-new-user',
          data: {
            email: user.email,
            userName: user.displayName || `${user.firstName} ${user.lastName}`,
            role: user.role === 'parent' ? 'Phụ huynh' : 'Học viên',
            courseName: course.title,
            classroomName: classroom.name,
            price: course.price.toLocaleString('vi-VN'),
            currency: course.currency,
            loginUrl,
            password, // Gửi password cho user mới
          },
        });

        this.logger.log(
          `Welcome email event sent to Kafka for ${user.email} (${user.role})`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to send welcome email events', error);
      // Don't throw - email failure shouldn't block enrollment
    }
  }

  /**
   * Send enrollment confirmation email to existing user
   */
  private async sendEnrollmentConfirmationEmail(
    userId: string,
    metadata: EnrollmentMetadata,
  ): Promise<void> {
    try {
      // Fetch user data
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      if (!user) {
        this.logger.warn(
          `User ${userId} not found for enrollment confirmation email`,
        );
        return;
      }

      // Fetch course and classroom info
      const [course, classroom] = await Promise.all([
        this.prisma.course.findUnique({
          where: { id: metadata.courseId },
          select: {
            title: true,
            price: true,
            currency: true,
            description: true,
          },
        }),
        this.prisma.classroom.findUnique({
          where: { id: metadata.classroomId },
          select: { name: true, periodStart: true, periodEnd: true },
        }),
      ]);

      if (!course || !classroom) {
        this.logger.warn(
          'Course or classroom not found for enrollment confirmation email',
        );
        return;
      }

      const dashboardUrl = `${this.configService.get('WEB_APP_URL')}/dashboard`;
      const classroomUrl = `${this.configService.get('WEB_APP_URL')}/classrooms/${metadata.classroomId}`;

      // Send confirmation email via Kafka
      await this.kafkaProducer.send(KafkaTopic.EMAIL_ENROLLMENT_CONFIRMATION, {
        type: 'enrollment-confirmation',
        data: {
          email: user.email,
          userName: user.displayName || `${user.firstName} ${user.lastName}`,
          courseName: course.title,
          classroomName: classroom.name,
          price: course.price.toLocaleString('vi-VN'),
          currency: course.currency,
          startDate: classroom.periodStart
            ? new Date(classroom.periodStart).toLocaleDateString('vi-VN')
            : 'Chưa xác định',
          endDate: classroom.periodEnd
            ? new Date(classroom.periodEnd).toLocaleDateString('vi-VN')
            : 'Chưa xác định',
          dashboardUrl,
          classroomUrl,
        },
      });

      this.logger.log(
        `Enrollment confirmation email event sent to Kafka for ${user.email}`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to send enrollment confirmation email event',
        error,
      );
      // Don't throw - email failure shouldn't block enrollment
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

  /**
   * Xác thực chữ ký VNPay
   */
  verifyVNPaySignature(returnData: VNPayReturnData): boolean {
    return this.vnpayService.verifyReturnData(returnData);
  }
}
