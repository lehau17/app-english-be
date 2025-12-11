import { PrismaRepository } from '@app/database';
import { KafkaService } from '@app/shared';
import { ICertificateIssuer } from '@app/shared/certificate/interfaces/certificate-issuer.interface';
import {
  getGradeLevel,
  isEligibleForCertificate
} from '@app/shared/certificate/utils/grade-level.util';
import { Injectable, Logger } from '@nestjs/common';
import { IssuedCertificate, NotificationChannel } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Certificate issuance service for background-worker
 * Issues certificates and sends notifications via Kafka
 */
@Injectable()
export class CertificateIssuanceService implements ICertificateIssuer {
  private readonly logger = new Logger(CertificateIssuanceService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly kafkaService?: KafkaService,
  ) {}

  /**
   * Issue certificate for a student
   * Implements ICertificateIssuer interface
   */
  async issueCertificate(dto: {
    studentId: string;
    courseId: string;
    classroomId?: string;
    finalScore: number;
    progress: number;
    totalHours: number;
  }): Promise<IssuedCertificate> {
    this.logger.log(
      `Issuing certificate for student ${dto.studentId}, course ${dto.courseId}`,
    );

    // Get student and course info
    const [student, course] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: dto.studentId },
        select: {
          id: true,
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
        },
      }),
      this.prisma.course.findUnique({
        where: { id: dto.courseId },
        select: {
          id: true,
          title: true,
        },
      }),
    ]);

    if (!student || !course) {
      throw new Error('Student or course not found');
    }

    // Get certificate template
    const template = await this.prisma.certificateTemplate.findFirst({
      where: {
        courseId: dto.courseId,
        isActive: true,
      },
    });

    if (!template) {
      throw new Error('Certificate template not found');
    }

    // Check grade level eligibility
    const gradeLevel = getGradeLevel(dto.finalScore);
    if (!isEligibleForCertificate(gradeLevel)) {
      throw new Error(
        `Grade level ${gradeLevel} (${dto.finalScore}%) is not eligible for certificate`,
      );
    }

    // Generate certificate number and verification code
    const certificateNumber = this.generateCertificateNumber(dto.courseId);
    const verificationCode = uuidv4();

    // Create certificate
    const certificate = await this.prisma.issuedCertificate.create({
      data: {
        template: {
          connect: { id: template.id },
        },
        student: {
          connect: { id: dto.studentId },
        },
        course: {
          connect: { id: dto.courseId },
        },
        classroom: {
          ...(dto.classroomId && {
            connect: { id: dto.classroomId },
          }),
        },
        studentEmail: student.email,
        certificateNumber,
        verificationCode,
        studentName:
          student.displayName ||
          `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
          student.email ||
          'Unknown',
        courseName: course.title,
        finalScore: dto.finalScore,
        progress: dto.progress,
        totalHours: dto.totalHours,
        gradeLevel,
        issueDate: new Date(),
        completionDate: new Date(),
      },
    });

    this.logger.log(
      `Certificate issued: ${certificateNumber} for student ${dto.studentId}`,
    );

    // Send notification via Kafka
    if (this.kafkaService) {
      await this.sendCertificateNotification(certificate, student.email);
    }

    return certificate;
  }

  /**
   * Send certificate notification via Kafka
   */
  private async sendCertificateNotification(
    certificate: IssuedCertificate,
    studentEmail?: string,
  ): Promise<void> {
    if (!this.kafkaService) {
      this.logger.warn('KafkaService not available, skipping notification');
      return;
    }

    try {
      // Get student email
      const student = await this.prisma.user.findUnique({
        where: { id: certificate.studentId },
        select: { email: true, displayName: true, firstName: true, lastName: true },
      });

      if (!student?.email) {
        this.logger.warn(
          `Student ${certificate.studentId} has no email, skipping certificate notification`,
        );
        return;
      }

      const studentName =
        student.displayName ||
        `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
        'Student';

      // Send to student
      await this.kafkaService.send('notifications', {
        userId: certificate.studentId,
        type: 'certificate-issued',
        channel: NotificationChannel.email,
        title: 'Chúc mừng! Bạn đã nhận được chứng chỉ',
        body: `Bạn đã hoàn thành khóa học ${certificate.courseName} và nhận được chứng chỉ ${certificate.gradeLevel}`,
        data: {
          email: student.email,
          studentName,
          courseName: certificate.courseName,
          gradeLevel: certificate.gradeLevel,
          finalScore: certificate.finalScore,
          certificateNumber: certificate.certificateNumber,
          downloadUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/private/v1/certificates/${certificate.id}/download`,
          verificationUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/public/v1/certificates/verify/code/${certificate.verificationCode}`,
        },
      });

      // Send to parents (if any)
      const parentChild = await this.prisma.parentChild.findMany({
        where: {
          childId: certificate.studentId,
        },
        select: {
          parentId: true,
        },
      });

      for (const pc of parentChild) {
        // Get parent email
        const parent = await this.prisma.user.findUnique({
          where: { id: pc.parentId },
          select: { email: true },
        });

        if (!parent?.email) {
          this.logger.warn(
            `Parent ${pc.parentId} has no email, skipping certificate notification`,
          );
          continue;
        }

        await this.kafkaService.send('notifications', {
          userId: pc.parentId,
          type: 'certificate-issued-parent',
          channel: NotificationChannel.email,
          title: 'Con bạn đã nhận được chứng chỉ',
          body: `Con bạn đã hoàn thành khóa học ${certificate.courseName} và nhận được chứng chỉ ${certificate.gradeLevel}`,
          data: {
            email: parent.email,
            childName: certificate.studentName,
            courseName: certificate.courseName,
            gradeLevel: certificate.gradeLevel,
            finalScore: certificate.finalScore,
            certificateNumber: certificate.certificateNumber,
            downloadUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/private/v1/certificates/${certificate.id}/download`,
            verificationUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/public/v1/certificates/verify/code/${certificate.verificationCode}`,
          },
        });
      }

      this.logger.log(
        `Sent certificate notifications for certificate ${certificate.certificateNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send certificate notification: ${error.message}`,
      );
    }
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
}
















