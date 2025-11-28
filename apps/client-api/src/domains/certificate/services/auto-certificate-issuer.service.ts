import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { IssuedCertificateService } from './issued-certificate.service';

/**
 * Service to automatically issue certificates when students complete courses
 */
@Injectable()
export class AutoCertificateIssuerService {
  private readonly logger = new Logger(AutoCertificateIssuerService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly certificateService: IssuedCertificateService,
  ) {}

  /**
   * Check if student is eligible for certificate and issue if eligible
   */
  async checkAndIssueCertificate(
    studentId: string,
    courseId: string,
    classroomId?: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Checking certificate eligibility for student ${studentId}, course ${courseId}`,
      );

      // Get course progress
      const progress = await this.calculateCourseProgress(
        studentId,
        courseId,
        classroomId,
      );

      if (!progress.isEligible) {
        this.logger.log(
          `Student ${studentId} not yet eligible for certificate. Progress: ${progress.completionPercentage}%, Score: ${progress.averageScore}%`,
        );
        return;
      }

      // Check if certificate already exists
      const existingCertificate = await this.prisma.issuedCertificate.findFirst(
        {
          where: {
            studentId,
            courseId,
            isRevoked: false,
          },
        },
      );

      if (existingCertificate) {
        this.logger.log(
          `Certificate already exists for student ${studentId}, course ${courseId}`,
        );
        return;
      }

      // Issue certificate
      await this.certificateService.issueCertificate({
        studentId,
        courseId,
        classroomId,
        finalScore: progress.averageScore,
        progress: progress.completionPercentage,
        totalHours: progress.totalHours,
      });

      this.logger.log(
        `Certificate issued successfully for student ${studentId}, course ${courseId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to issue certificate for student ${studentId}, course ${courseId}`,
        error.stack,
      );
    }
  }

  /**
   * Calculate course progress and eligibility
   */
  private async calculateCourseProgress(
    studentId: string,
    courseId: string,
    classroomId?: string,
  ): Promise<{
    completionPercentage: number;
    averageScore: number;
    totalHours: number;
    isEligible: boolean;
  }> {
    // Get all assignments for the course/classroom
    const assignments = await this.prisma.assignment.findMany({
      where: {
        classroom: {
          courseId,
          ...(classroomId && { id: classroomId }),
        },
      },
      include: {
        submissions: {
          where: {
            studentId,
          },
        },
      },
    });

    if (assignments.length === 0) {
      // No assignments = 100% completion if student enrolled
      return {
        completionPercentage: 100,
        averageScore: 100,
        totalHours: 0,
        isEligible: true,
      };
    }

    // Calculate completion
    const completedAssignments = assignments.filter(
      (a) => a.submissions.length > 0 && a.submissions[0].status === 'graded',
    );

    const completionPercentage =
      (completedAssignments.length / assignments.length) * 100;

    // Calculate average score
    const scores = completedAssignments
      .map((a) => a.submissions[0])
      .filter((s) => s.score !== null)
      .map((s) => s.score as number);

    const averageScore =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0;

    // Calculate total hours (estimate based on time spent on assignments)
    const totalHours = completedAssignments.reduce((total, assignment) => {
      const submission = assignment.submissions[0];
      if (submission.submittedAt && submission.startedAt) {
        const hours =
          (submission.submittedAt.getTime() - submission.startedAt.getTime()) /
          (1000 * 60 * 60);
        return total + hours;
      }
      return total;
    }, 0);

    // Check eligibility: 100% completion required
    const isEligible = completionPercentage >= 100;

    return {
      completionPercentage,
      averageScore,
      totalHours,
      isEligible,
    };
  }

  /**
   * Batch check and issue certificates for all eligible students
   */
  async batchIssueCertificates(courseId?: string): Promise<void> {
    this.logger.log(
      `Starting batch certificate issuance${courseId ? ` for course ${courseId}` : ''}`,
    );

    try {
      // Get all active classrooms
      const classrooms = await this.prisma.classroom.findMany({
        where: {
          ...(courseId && { courseId }),
          status: 'active',
        },
        include: {
          students: {
            select: {
              id: true,
            },
          },
        },
      });

      let totalChecked = 0;
      const totalIssued = 0;

      for (const classroom of classrooms) {
        for (const student of classroom.students) {
          totalChecked++;
          await this.checkAndIssueCertificate(
            student.id,
            classroom.courseId,
            classroom.id,
          );
        }
      }

      this.logger.log(
        `Batch certificate issuance complete. Checked: ${totalChecked}, Issued: ${totalIssued}`,
      );
    } catch (error) {
      this.logger.error('Batch certificate issuance failed', error.stack);
    }
  }
}
