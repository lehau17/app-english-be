import { PrismaRepository } from '@app/database';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ClassroomStatus } from '@prisma/client';
import { CourseCompletionService } from './course-completion.service';
import { ICertificateIssuer } from './interfaces/certificate-issuer.interface';
import {
  getGradeLevel,
  isEligibleForCertificate,
} from './utils/grade-level.util';

/**
 * Interface for gradebook service (optional dependency)
 */
export interface IGradebookService {
  calculateStudentGrade(
    studentId: string,
    classroomId: string,
  ): Promise<{ finalGrade: number }>;
}

/**
 * Service to automatically issue certificates when students complete courses
 * Moved to shared library to be used by both client-api and background-worker
 */
@Injectable()
export class AutoCertificateIssuerService {
  private readonly logger = new Logger(AutoCertificateIssuerService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    @Inject('ICertificateIssuer')
    private readonly certificateService: ICertificateIssuer,
    private readonly courseCompletionService: CourseCompletionService,
    @Optional()
    @Inject('IGradebookService')
    private readonly gradebookService?: IGradebookService,
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

      // Get comprehensive course completion
      const completion =
        await this.courseCompletionService.calculateCourseCompletion(
          studentId,
          courseId,
          classroomId,
        );

      if (!completion.isCompleted) {
        this.logger.log(
          `Student ${studentId} not yet completed course. Completion: ${completion.completionPercentage}% (Activities: ${completion.activitiesCompleted}/${completion.activitiesTotal}, Assignments: ${completion.assignmentsCompleted}/${completion.assignmentsTotal})`,
        );
        return;
      }

      // Get course progress for score calculation (fallback to old method)
      const progress = await this.calculateCourseProgress(
        studentId,
        courseId,
        classroomId,
      );

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

      // Get gradebook final grade if classroomId provided (more accurate)
      let finalScore = progress.averageScore; // Fallback to assignment average
      if (classroomId && this.gradebookService) {
        try {
          const gradebook = await this.gradebookService.calculateStudentGrade(
            studentId,
            classroomId,
          );
          finalScore = gradebook.finalGrade; // Use weighted gradebook final grade
          this.logger.log(
            `Using gradebook final grade ${finalScore} for student ${studentId}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to get gradebook grade for student ${studentId}, using assignment average: ${error.message}`,
          );
          // Continue with assignment average as fallback
        }
      }

      // Check grade level eligibility (only Xuất sắc, Giỏi, Khá >= 70)
      const gradeLevel = getGradeLevel(finalScore);
      if (!isEligibleForCertificate(gradeLevel)) {
        this.logger.log(
          `Student ${studentId} not eligible for certificate. Grade level: ${gradeLevel} (${finalScore}%). Minimum required: 70% (Khá)`,
        );
        return;
      }

      // Issue certificate
      await this.certificateService.issueCertificate({
        studentId,
        courseId,
        classroomId,
        finalScore,
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
      if (submission.submittedAt && submission.createdAt) {
        const hours =
          (submission.submittedAt.getTime() - submission.createdAt.getTime()) /
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
          status: ClassroomStatus.completed,
        },
        include: {
          students: {
            select: {
              studentId: true,
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
            student.studentId,
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

  /**
   * Issue certificates for all eligible students in a completed classroom
   */
  async issueCertificatesForClassroom(classroomId: string): Promise<void> {
    this.logger.log(
      `Issuing certificates for all eligible students in classroom ${classroomId}`,
    );

    try {
      // Get classroom with course info
      const classroom = await this.prisma.classroom.findUnique({
        where: { id: classroomId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      if (!classroom) {
        this.logger.error(`Classroom ${classroomId} not found`);
        return;
      }

      // Get all active students in classroom
      const classroomStudents = await this.prisma.classroomStudent.findMany({
        where: {
          classroomId,
          isActive: true,
        },
        include: {
          student: {
            select: {
              id: true,
            },
          },
        },
      });

      this.logger.log(
        `Found ${classroomStudents.length} students in classroom ${classroomId}`,
      );

      let issuedCount = 0;
      let skippedCount = 0;

      // Process each student
      for (const cs of classroomStudents) {
        try {
          // Check if student completed all requirements (comprehensive)
          const completion =
            await this.courseCompletionService.calculateCourseCompletion(
              cs.studentId,
              classroom.courseId,
              classroomId,
            );

          if (!completion.isCompleted) {
            this.logger.log(
              `Student ${cs.studentId} not completed. Completion: ${completion.completionPercentage}%`,
            );
            skippedCount++;
            continue;
          }

          // Get progress for score calculation
          const progress = await this.calculateCourseProgress(
            cs.studentId,
            classroom.courseId,
            classroomId,
          );

          // Get gradebook final grade
          let finalScore = progress.averageScore; // Fallback
          if (this.gradebookService) {
            try {
              const gradebook =
                await this.gradebookService.calculateStudentGrade(
                  cs.studentId,
                  classroomId,
                );
              finalScore = gradebook.finalGrade;
            } catch (error) {
              this.logger.warn(
                `Failed to get gradebook grade for student ${cs.studentId}, using assignment average`,
              );
            }
          }

          // Check grade level eligibility
          const gradeLevel = getGradeLevel(finalScore);
          if (!isEligibleForCertificate(gradeLevel)) {
            this.logger.log(
              `Student ${cs.studentId} not eligible. Grade level: ${gradeLevel} (${finalScore}%)`,
            );
            skippedCount++;
            continue;
          }

          // Check if certificate already exists
          const existing = await this.prisma.issuedCertificate.findFirst({
            where: {
              studentId: cs.studentId,
              courseId: classroom.courseId,
              classroomId,
              isRevoked: false,
            },
          });

          if (existing) {
            this.logger.log(
              `Certificate already exists for student ${cs.studentId}`,
            );
            skippedCount++;
            continue;
          }

          // Issue certificate
          await this.certificateService.issueCertificate({
            studentId: cs.studentId,
            courseId: classroom.courseId,
            classroomId,
            finalScore,
            progress: progress.completionPercentage,
            totalHours: progress.totalHours,
          });

          issuedCount++;
          this.logger.log(
            `Issued certificate for student ${cs.studentId} (${gradeLevel}, ${finalScore}%)`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to issue certificate for student ${cs.studentId}: ${error.message}`,
          );
          skippedCount++;
        }
      }

      this.logger.log(
        `Certificate issuance complete for classroom ${classroomId}. Issued: ${issuedCount}, Skipped: ${skippedCount}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to issue certificates for classroom ${classroomId}: ${error.stack}`,
      );
    }
  }
}
