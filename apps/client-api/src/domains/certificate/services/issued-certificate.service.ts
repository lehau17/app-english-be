import { PrismaRepository } from '@app/database';
import { KafkaService } from '@app/shared';
import {
  getGradeLevel,
  isEligibleForCertificate,
  MIN_CERTIFICATE_SCORE,
} from '@app/shared/certificate';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  IssuedCertificate,
  NotificationChannel,
  NotificationType,
} from '@prisma/client';
import * as puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from '../../notification/service';
import { IssueCertificateDto } from '../dto';
import { IssuedCertificateRepository } from '../repository';
import { CertificateTemplateService } from './certificate-template.service';

@Injectable()
export class IssuedCertificateService {
  private readonly logger = new Logger(IssuedCertificateService.name);

  constructor(
    private readonly certificateRepo: IssuedCertificateRepository,
    private readonly templateService: CertificateTemplateService,
    private readonly prisma: PrismaRepository,
    private readonly notificationService?: NotificationService,
    private readonly kafkaService?: KafkaService,
  ) {}

  /**
   * Issue certificate for a student
   */
  async issueCertificate(dto: IssueCertificateDto): Promise<IssuedCertificate> {
    this.logger.log(
      `Issuing certificate for student ${dto.studentId}, course ${dto.courseId}`,
    );

    // Check if certificate already exists
    const existing = await this.certificateRepo.findByStudentAndCourse(
      dto.studentId,
      dto.courseId,
    );
    if (existing && !existing.isRevoked) {
      throw new ConflictException(
        'Certificate already issued for this student and course',
      );
    }

    // Get certificate template
    const template = await this.templateService.getTemplateByCourseId(
      dto.courseId,
    );
    if (!template.isActive) {
      throw new BadRequestException('Certificate template is not active');
    }

    // Check requirements
    const progress = dto.progress || 100;
    if (progress < template.minProgress) {
      throw new BadRequestException(
        `Student progress (${progress}%) does not meet minimum requirement (${template.minProgress}%)`,
      );
    }

    // Check score requirement if applicable
    if (
      template.requirementType === 'score_based' ||
      template.requirementType === 'combined'
    ) {
      if (!dto.finalScore) {
        throw new BadRequestException(
          'Final score is required for this certificate type',
        );
      }
      if (template.minScore && dto.finalScore < template.minScore) {
        throw new BadRequestException(
          `Student score (${dto.finalScore}%) does not meet minimum requirement (${template.minScore}%)`,
        );
      }
    }

    // Check grade level eligibility (only Xuất sắc, Giỏi, Khá >= 70)
    let gradeLevel: string | undefined;
    if (dto.finalScore !== null && dto.finalScore !== undefined) {
      gradeLevel = getGradeLevel(dto.finalScore);
      if (!isEligibleForCertificate(gradeLevel as any)) {
        throw new BadRequestException(
          `Grade level ${gradeLevel} (${dto.finalScore}%) is not eligible for certificate. Minimum required: ${MIN_CERTIFICATE_SCORE}% (Khá)`,
        );
      }
    }

    // Get student and course info
    const student = await this.prisma.user.findUnique({
      where: { id: dto.studentId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
      },
    });

    if (!student) {
      throw new NotFoundException(`Student not found with id ${dto.studentId}`);
    }

    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: {
        id: true,
        title: true,
        description: true,
        estimatedHours: true,
      },
    });

    if (!course) {
      throw new NotFoundException(`Course not found with id ${dto.courseId}`);
    }

    // Generate certificate number and verification code
    const certificateNumber = this.generateCertificateNumber(dto.courseId);
    const verificationCode = uuidv4();

    // Get student full name
    const studentName =
      student.displayName ||
      [student.firstName, student.lastName].filter(Boolean).join(' ') ||
      student.email ||
      'Student';

    // Create certificate
    const certificate = await this.certificateRepo.create({
      template: {
        connect: { id: template.id },
      },
      student: {
        connect: { id: dto.studentId },
      },
      course: {
        connect: { id: dto.courseId },
      },
      ...(dto.classroomId && {
        classroom: {
          connect: { id: dto.classroomId },
        },
      }),
      certificateNumber,
      verificationCode,
      studentName,
      studentEmail: student.email || '',
      courseName: course.title,
      courseDescription: course.description,
      finalScore: dto.finalScore,
      gradeLevel: gradeLevel || null,
      progress,
      totalHours: dto.totalHours || course.estimatedHours,
      metadata: dto.metadata,
    });

    this.logger.log(
      `Issued certificate ${certificate.id} (${certificateNumber})`,
    );

    // Send notifications (non-blocking, don't fail certificate creation if notification fails)
    this.sendCertificateNotifications(
      certificate,
      student,
      course,
      gradeLevel || null,
      certificateNumber,
      verificationCode,
    ).catch((error) => {
      this.logger.error(
        `Failed to send certificate notifications for certificate ${certificate.id}`,
        error.stack,
      );
    });

    return certificate;
  }

  /**
   * Send system and email notifications when certificate is issued
   */
  private async sendCertificateNotifications(
    certificate: IssuedCertificate,
    student: {
      id: string;
      email: string | null;
      displayName: string | null;
      firstName: string | null;
      lastName: string | null;
    },
    course: { title: string },
    gradeLevel: string | null,
    certificateNumber: string,
    verificationCode: string,
  ): Promise<void> {
    if (!this.notificationService || !this.kafkaService) {
      this.logger.warn(
        'NotificationService or KafkaService not available, skipping notifications',
      );
      return;
    }

    const studentName =
      student.displayName ||
      [student.firstName, student.lastName].filter(Boolean).join(' ') ||
      student.email ||
      'Student';

    // 1. System notification for student
    try {
      await this.notificationService.create({
        userId: student.id,
        type: NotificationType.system,
        title: 'Bạn đã nhận được chứng chỉ',
        body: `Chúc mừng! Bạn đã hoàn thành khóa học ${course.title}${gradeLevel ? ` với điểm số ${gradeLevel}` : ''}`,
        channel: NotificationChannel.in_app,
        data: JSON.stringify({
          certificateId: certificate.id,
          courseId: certificate.courseId,
          classroomId: certificate.classroomId,
          gradeLevel,
          certificateNumber,
        }),
      });
      this.logger.log(`System notification created for student ${student.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to create system notification for student: ${error.message}`,
      );
    }

    // 2. System notifications for parents
    try {
      const parents = await this.findLinkedParents(student.id);
      for (const parent of parents) {
        await this.notificationService.create({
          userId: parent.id,
          type: NotificationType.system,
          title: 'Con bạn đã nhận được chứng chỉ',
          body: `${studentName} đã hoàn thành khóa học ${course.title}${gradeLevel ? ` với điểm số ${gradeLevel}` : ''}`,
          channel: NotificationChannel.in_app,
          data: JSON.stringify({
            childId: student.id,
            childName: studentName,
            certificateId: certificate.id,
            courseId: certificate.courseId,
            classroomId: certificate.classroomId,
            gradeLevel,
            certificateNumber,
          }),
        });
        this.logger.log(`System notification created for parent ${parent.id}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to create parent notifications: ${error.message}`,
      );
    }

    // 3. Email notification for student
    if (student.email) {
      try {
        const downloadUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/private/v1/certificates/${certificate.id}/download`;
        const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify/${verificationCode}`;

        await this.kafkaService.sendAsync('notifications', {
          type: 'certificate-issued',
          userId: student.id,
          email: student.email,
          channel: 'email',
          template: 'certificate-issued',
          data: {
            studentName,
            courseName: course.title,
            gradeLevel: gradeLevel || 'N/A',
            finalScore: certificate.finalScore,
            certificateNumber,
            downloadUrl,
            verificationUrl,
          },
        });
        this.logger.log(`Email notification queued for student ${student.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to queue email notification for student: ${error.message}`,
        );
      }
    }

    // 4. Email notifications for parents
    try {
      const parents = await this.findLinkedParents(student.id);
      for (const parent of parents) {
        if (parent.email) {
          const downloadUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/private/v1/certificates/${certificate.id}/download`;
          const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify/${verificationCode}`;

          await this.kafkaService.sendAsync('notifications', {
            type: 'certificate-issued-parent',
            userId: parent.id,
            email: parent.email,
            channel: 'email',
            template: 'parent-certificate-issued',
            data: {
              childName: studentName,
              courseName: course.title,
              gradeLevel: gradeLevel || 'N/A',
              finalScore: certificate.finalScore,
              certificateNumber,
              downloadUrl,
              verificationUrl,
            },
          });
          this.logger.log(`Email notification queued for parent ${parent.id}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to queue parent email notifications: ${error.message}`,
      );
    }
  }

  /**
   * Find all linked parents for a student
   */
  private async findLinkedParents(
    studentId: string,
  ): Promise<Array<{ id: string; email: string | null }>> {
    try {
      const relations = await this.prisma.parentChild.findMany({
        where: {
          childId: studentId,
          // Assuming there's a status field, adjust if needed
        },
        include: {
          parent: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });
      return relations.map((r) => r.parent).filter((p) => p !== null);
    } catch (error) {
      this.logger.error(
        `Failed to find linked parents for student ${studentId}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get my certificates (for student)
   */
  async getMyCertificates(
    studentId: string,
    params?: {
      skip?: number;
      take?: number;
    },
  ): Promise<{ data: IssuedCertificate[]; total: number }> {
    const where = {
      studentId,
      isRevoked: false,
    };

    const [data, total] = await Promise.all([
      this.certificateRepo.findMany({
        where,
        skip: params?.skip,
        take: params?.take,
        orderBy: { issueDate: 'desc' },
      }),
      this.certificateRepo.count(where),
    ]);

    return { data, total };
  }

  /**
   * Get certificate by ID
   */
  async getCertificateById(id: string): Promise<IssuedCertificate> {
    const certificate = await this.certificateRepo.findById(id);
    if (!certificate) {
      throw new NotFoundException(`Certificate not found with id ${id}`);
    }
    return certificate;
  }

  /**
   * Verify certificate by verification code
   */
  async verifyCertificate(
    verificationCode: string,
  ): Promise<IssuedCertificate> {
    const certificate =
      await this.certificateRepo.findByVerificationCode(verificationCode);

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    // Update verified at timestamp
    if (!certificate.verifiedAt) {
      await this.certificateRepo.update(certificate.id, {
        verifiedAt: new Date(),
      });
    }

    return certificate;
  }

  /**
   * Verify certificate by certificate number
   */
  async verifyCertificateByNumber(
    certificateNumber: string,
  ): Promise<IssuedCertificate> {
    const certificate =
      await this.certificateRepo.findByCertificateNumber(certificateNumber);

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    return certificate;
  }

  /**
   * Revoke certificate
   */
  async revokeCertificate(
    id: string,
    reason: string,
  ): Promise<IssuedCertificate> {
    this.logger.log(`Revoking certificate ${id}. Reason: ${reason}`);

    const certificate = await this.getCertificateById(id);

    if (certificate.isRevoked) {
      throw new BadRequestException('Certificate is already revoked');
    }

    const revoked = await this.certificateRepo.revoke(id, reason);

    this.logger.log(`Revoked certificate ${id}`);
    return revoked;
  }

  /**
   * Get certificates for a course
   */
  async getCertificatesByCourse(
    courseId: string,
    params?: {
      skip?: number;
      take?: number;
      includeRevoked?: boolean;
    },
  ): Promise<{ data: IssuedCertificate[]; total: number }> {
    const where = {
      courseId,
      ...(params?.includeRevoked === false && { isRevoked: false }),
    };

    const [data, total] = await Promise.all([
      this.certificateRepo.findMany({
        where,
        skip: params?.skip,
        take: params?.take,
        orderBy: { issueDate: 'desc' },
      }),
      this.certificateRepo.count(where),
    ]);

    return { data, total };
  }

  /**
   * Get all certificates (admin)
   */
  async getAllCertificates(params?: {
    skip?: number;
    take?: number;
    includeRevoked?: boolean;
    studentId?: string;
    courseId?: string;
  }): Promise<{ data: IssuedCertificate[]; total: number }> {
    const where: any = {};

    if (params?.includeRevoked === false) {
      where.isRevoked = false;
    }

    if (params?.studentId) {
      where.studentId = params.studentId;
    }

    if (params?.courseId) {
      where.courseId = params.courseId;
    }

    const [data, total] = await Promise.all([
      this.certificateRepo.findMany({
        where,
        skip: params?.skip,
        take: params?.take,
        orderBy: { issueDate: 'desc' },
      }),
      this.certificateRepo.count(where),
    ]);

    return { data, total };
  }

  /**
   * Generate unique certificate number
   */
  private generateCertificateNumber(courseId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const coursePrefix = courseId.substring(0, 4).toUpperCase();

    return `CERT-${coursePrefix}-${timestamp}-${random}`;
  }

  /**
   * Generate certificate PDF
   */
  async generateCertificatePdf(
    certificate: IssuedCertificate,
  ): Promise<Buffer> {
    // Use Chrome for Testing (ARM64 version for Mac Silicon)
    const executablePath = '/usr/bin/google-chrome';

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
      ],
    });

    try {
      const page = await browser.newPage();

      // Generate HTML content for the certificate
      const htmlContent = this.generateCertificateHtml(certificate);

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate HTML content for certificate PDF
   */
  private generateCertificateHtml(certificate: IssuedCertificate): string {
    const completionDate = new Date(
      certificate.completionDate,
    ).toLocaleDateString('vi-VN');
    const issueDate = new Date(certificate.issueDate).toLocaleDateString(
      'vi-VN',
    );

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate - ${certificate.courseName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Times New Roman', serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .certificate {
            background: white;
            width: 800px;
            height: 600px;
            border: 8px solid #d4af37;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            position: relative;
            overflow: hidden;
        }

        .certificate::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background:
                radial-gradient(circle at 20% 20%, rgba(212, 175, 55, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(212, 175, 55, 0.1) 0%, transparent 50%);
            pointer-events: none;
        }

        .header {
            text-align: center;
            padding: 40px 20px 20px;
            border-bottom: 3px solid #d4af37;
            margin-bottom: 30px;
        }

        .title {
            font-size: 36px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .subtitle {
            font-size: 18px;
            color: #7f8c8d;
            font-style: italic;
        }

        .content {
            padding: 0 40px;
            text-align: center;
        }

        .award-text {
            font-size: 20px;
            color: #34495e;
            margin-bottom: 30px;
            line-height: 1.6;
        }

        .student-name {
            font-size: 32px;
            font-weight: bold;
            color: #2c3e50;
            margin: 20px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .course-info {
            font-size: 18px;
            color: #34495e;
            margin: 20px 0;
            line-height: 1.5;
        }

        .course-name {
            font-weight: bold;
            color: #e74c3c;
            font-size: 22px;
        }

        .details {
            display: flex;
            justify-content: space-between;
            margin: 40px 0 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
        }

        .detail-item {
            text-align: center;
        }

        .detail-label {
            font-size: 14px;
            color: #7f8c8d;
            margin-bottom: 5px;
        }

        .detail-value {
            font-size: 16px;
            font-weight: bold;
            color: #2c3e50;
        }

        .footer {
            position: absolute;
            bottom: 20px;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            padding: 0 40px;
            align-items: end;
        }

        .signature {
            text-align: center;
        }

        .signature-line {
            width: 200px;
            height: 2px;
            background: #2c3e50;
            margin: 0 auto 10px;
        }

        .signature-text {
            font-size: 14px;
            color: #7f8c8d;
        }

        .verification {
            text-align: right;
            font-size: 12px;
            color: #95a5a6;
        }

        .verification-code {
            font-family: monospace;
            font-weight: bold;
            color: #2c3e50;
        }

        .seal {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 80px;
            height: 80px;
            border: 3px solid #d4af37;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        .seal-text {
            font-size: 12px;
            font-weight: bold;
            color: #d4af37;
            text-align: center;
            line-height: 1.2;
        }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="seal">
            <div class="seal-text">
                ENGLISH<br>
                LEARNING<br>
                PLATFORM
            </div>
        </div>

        <div class="header">
            <div class="title">Chứng Chỉ Hoàn Thành</div>
            <div class="subtitle">Certificate of Completion</div>
        </div>

        <div class="content">
            <div class="award-text">
                Được trao tặng cho
            </div>

            <div class="student-name">
                ${certificate.studentName}
            </div>

            <div class="course-info">
                Đã hoàn thành xuất sắc khóa học<br>
                <span class="course-name">${certificate.courseName}</span>
            </div>

            <div class="details">
                <div class="detail-item">
                    <div class="detail-label">Ngày hoàn thành</div>
                    <div class="detail-value">${completionDate}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Điểm số</div>
                    <div class="detail-value">${certificate.finalScore || 'N/A'}/100</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Tiến độ</div>
                    <div class="detail-value">${certificate.progress}%</div>
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="signature">
                <div class="signature-line"></div>
                <div class="signature-text">Giám đốc đào tạo</div>
            </div>

            <div class="verification">
                <div>Mã xác thực:</div>
                <div class="verification-code">${certificate.verificationCode}</div>
                <div>Ngày cấp: ${issueDate}</div>
            </div>
        </div>
    </div>
</body>
</html>
        `;
  }

  /**
   * Get public certificate share view (HTML) - simplified version for sharing
   */
  async getPublicCertificateShare(verificationCode: string): Promise<string> {
    const certificate = await this.verifyCertificate(verificationCode);

    if (certificate.isRevoked) {
      throw new BadRequestException('Certificate has been revoked');
    }

    const shareUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/public/v1/certificates/share/${verificationCode}`;
    const downloadUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/public/v1/certificates/share/${verificationCode}/download`;
    const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/public/v1/certificates/verify/code/${verificationCode}`;

    const completionDate = new Date(
      certificate.completionDate,
    ).toLocaleDateString('vi-VN');
    const issueDate = new Date(certificate.issueDate).toLocaleDateString(
      'vi-VN',
    );

    // Enhanced HTML with share buttons and download link
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:title" content="Certificate - ${certificate.courseName}">
    <meta property="og:description" content="Certificate of Completion for ${certificate.studentName}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${shareUrl}">
    <title>Certificate - ${certificate.courseName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Times New Roman', serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            max-width: 900px;
            width: 100%;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            padding: 30px;
        }

        .certificate {
            background: white;
            width: 100%;
            border: 8px solid #d4af37;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            position: relative;
            overflow: hidden;
            margin-bottom: 30px;
        }

        .certificate::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background:
                radial-gradient(circle at 20% 20%, rgba(212, 175, 55, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(212, 175, 55, 0.1) 0%, transparent 50%);
            pointer-events: none;
        }

        .header {
            text-align: center;
            padding: 40px 20px 20px;
            border-bottom: 3px solid #d4af37;
            margin-bottom: 30px;
        }

        .title {
            font-size: 36px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .subtitle {
            font-size: 18px;
            color: #7f8c8d;
            font-style: italic;
        }

        .content {
            padding: 0 40px;
            text-align: center;
        }

        .award-text {
            font-size: 20px;
            color: #34495e;
            margin-bottom: 30px;
            line-height: 1.6;
        }

        .student-name {
            font-size: 32px;
            font-weight: bold;
            color: #2c3e50;
            margin: 20px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .course-info {
            font-size: 18px;
            color: #34495e;
            margin: 20px 0;
            line-height: 1.5;
        }

        .course-name {
            font-weight: bold;
            color: #e74c3c;
            font-size: 22px;
        }

        .details {
            display: flex;
            justify-content: space-between;
            margin: 40px 0 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
        }

        .detail-item {
            text-align: center;
        }

        .detail-label {
            font-size: 14px;
            color: #7f8c8d;
            margin-bottom: 5px;
        }

        .detail-value {
            font-size: 16px;
            font-weight: bold;
            color: #2c3e50;
        }

        .footer {
            position: relative;
            bottom: 20px;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            padding: 0 40px 20px;
            align-items: end;
        }

        .signature {
            text-align: center;
        }

        .signature-line {
            width: 200px;
            height: 2px;
            background: #2c3e50;
            margin: 0 auto 10px;
        }

        .signature-text {
            font-size: 14px;
            color: #7f8c8d;
        }

        .verification {
            text-align: right;
            font-size: 12px;
            color: #95a5a6;
        }

        .verification-code {
            font-family: monospace;
            font-weight: bold;
            color: #2c3e50;
        }

        .seal {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 80px;
            height: 80px;
            border: 3px solid #d4af37;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        .seal-text {
            font-size: 12px;
            font-weight: bold;
            color: #d4af37;
            text-align: center;
            line-height: 1.2;
        }

        .actions {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 20px;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s;
        }

        .btn-primary {
            background: #3498db;
            color: white;
        }

        .btn-primary:hover {
            background: #2980b9;
        }

        .btn-success {
            background: #27ae60;
            color: white;
        }

        .btn-success:hover {
            background: #229954;
        }

        .btn-share {
            background: #34495e;
            color: white;
        }

        .btn-share:hover {
            background: #2c3e50;
        }

        .share-buttons {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 15px;
        }

        .share-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s;
        }

        .share-btn-linkedin {
            background: #0077b5;
            color: white;
        }

        .share-btn-linkedin:hover {
            background: #005885;
        }

        .share-btn-facebook {
            background: #1877f2;
            color: white;
        }

        .share-btn-facebook:hover {
            background: #1565c0;
        }

        .share-btn-twitter {
            background: #1da1f2;
            color: white;
        }

        .share-btn-twitter:hover {
            background: #0d8bd9;
        }

        .info-box {
            background: #ecf0f1;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            text-align: center;
            font-size: 14px;
            color: #7f8c8d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="certificate">
            <div class="seal">
                <div class="seal-text">
                    ENGLISH<br>
                    LEARNING<br>
                    PLATFORM
                </div>
            </div>

            <div class="header">
                <div class="title">Chứng Chỉ Hoàn Thành</div>
                <div class="subtitle">Certificate of Completion</div>
            </div>

            <div class="content">
                <div class="award-text">
                    Được trao tặng cho
                </div>

                <div class="student-name">
                    ${certificate.studentName}
                </div>

                <div class="course-info">
                    Đã hoàn thành xuất sắc khóa học<br>
                    <span class="course-name">${certificate.courseName}</span>
                </div>

                <div class="details">
                    <div class="detail-item">
                        <div class="detail-label">Ngày hoàn thành</div>
                        <div class="detail-value">${completionDate}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Điểm số</div>
                        <div class="detail-value">${certificate.finalScore || 'N/A'}/100</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Tiến độ</div>
                        <div class="detail-value">${certificate.progress}%</div>
                    </div>
                </div>
            </div>

            <div class="footer">
                <div class="signature">
                    <div class="signature-line"></div>
                    <div class="signature-text">Giám đốc đào tạo</div>
                </div>

                <div class="verification">
                    <div>Mã xác thực:</div>
                    <div class="verification-code">${certificate.verificationCode}</div>
                    <div>Ngày cấp: ${issueDate}</div>
                </div>
            </div>
        </div>

        <div class="actions">
            <a href="${downloadUrl}" class="btn btn-primary" download>📥 Tải PDF</a>
            <a href="${verificationUrl}" class="btn btn-success" target="_blank">✓ Xác thực</a>
        </div>

        <div class="share-buttons">
            <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}"
               target="_blank"
               class="share-btn share-btn-linkedin">
                LinkedIn
            </a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}"
               target="_blank"
               class="share-btn share-btn-facebook">
                Facebook
            </a>
            <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Certificate of Completion: ${certificate.courseName}`)}"
               target="_blank"
               class="share-btn share-btn-twitter">
                Twitter
            </a>
        </div>

        <div class="info-box">
            <strong>Mã xác thực:</strong> ${certificate.verificationCode}<br>
            Sử dụng mã này để xác thực chứng chỉ tại: <a href="${verificationUrl}" target="_blank">${verificationUrl}</a>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Get public certificate PDF
   */
  async getPublicCertificatePDF(verificationCode: string): Promise<Buffer> {
    const certificate = await this.verifyCertificate(verificationCode);

    if (certificate.isRevoked) {
      throw new BadRequestException('Certificate has been revoked');
    }

    return this.generateCertificatePdf(certificate);
  }
}
