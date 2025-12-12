import { PrismaRepository } from '@app/database';
import {
  AutoCertificateIssuerService,
  CourseCompletionService,
} from '@app/shared/certificate';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClassroomStatus } from '@prisma/client';
import { CertificateIssuanceService } from './certificate-issuance.service';

@Injectable()
export class CertificateIssuanceCron {
  private readonly logger = new Logger(CertificateIssuanceCron.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly autoCertificateIssuer: AutoCertificateIssuerService,
    private readonly certificateIssuanceService: CertificateIssuanceService,
    private readonly courseCompletionService: CourseCompletionService,
  ) {}

  /**
   * Check completed classrooms and issue certificates for eligible students
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCertificateIssuance(): Promise<void> {
    this.logger.log('Starting certificate issuance cron job');

    try {
      // Get all completed classrooms
      const completedClassrooms = await this.prisma.classroom.findMany({
        where: {
          status: ClassroomStatus.completed,
        },
        select: {
          id: true,
          name: true,
          courseId: true,
        },
      });

      this.logger.log(
        `Found ${completedClassrooms.length} completed classrooms`,
      );

      const totalIssued = 0;
      const totalSkipped = 0;

      for (const classroom of completedClassrooms) {
        try {
          await this.autoCertificateIssuer.issueCertificatesForClassroom(
            classroom.id,
          );
          // Note: issueCertificatesForClassroom logs its own results
        } catch (error) {
          this.logger.error(
            `Failed to process classroom ${classroom.id}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `Certificate issuance cron job completed. Processed ${completedClassrooms.length} classrooms`,
      );
    } catch (error) {
      this.logger.error(`Certificate issuance cron job failed: ${error.stack}`);
    }
  }
}







