import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { ProgressState } from '@prisma/client';

/**
 * Service to calculate comprehensive course completion
 * Includes: lessons, activities, and assignments
 */
@Injectable()
export class CourseCompletionService {
  private readonly logger = new Logger(CourseCompletionService.name);

  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Calculate comprehensive course completion
   * Checks: lessons, activities (Progress), and assignments
   */
  async calculateCourseCompletion(
    studentId: string,
    courseId: string,
    classroomId?: string,
  ): Promise<{
    completionPercentage: number;
    isCompleted: boolean;
    activitiesCompleted: number;
    activitiesTotal: number;
    assignmentsCompleted: number;
    assignmentsTotal: number;
    details: {
      lessons: number;
      activities: number;
      assignments: number;
    };
  }> {
    try {
      // 1. Get all lessons in course
      const lessons = await this.prisma.lesson.findMany({
        where: { courseId },
        select: {
          id: true,
          activities: {
            select: {
              id: true,
            },
          },
        },
        orderBy: { orderNo: 'asc' },
      });

      const allActivityIds = lessons.flatMap((lesson) =>
        lesson.activities.map((a) => a.id),
      );

      // 2. Check activity completion (Progress table)
      const activityProgress = await this.prisma.progress.findMany({
        where: {
          userId: studentId,
          activityId: { in: allActivityIds },
          state: ProgressState.done,
        },
        select: {
          activityId: true,
        },
      });

      const completedActivityIds = new Set(
        activityProgress.map((p) => p.activityId),
      );
      const activitiesCompleted = completedActivityIds.size;
      const activitiesTotal = allActivityIds.length;

      // 3. Get all assignments for course/classroom
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
              status: 'graded',
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      });

      const assignmentsCompleted = assignments.filter(
        (a) => a.submissions.length > 0,
      ).length;
      const assignmentsTotal = assignments.length;

      // 4. Calculate overall completion
      const totalItems = activitiesTotal + assignmentsTotal;
      const completedItems = activitiesCompleted + assignmentsCompleted;

      // Handle edge case: no activities and no assignments
      if (totalItems === 0) {
        this.logger.warn(
          `Course ${courseId} has no activities or assignments. Treating as completed.`,
        );
        return {
          completionPercentage: 100,
          isCompleted: true,
          activitiesCompleted: 0,
          activitiesTotal: 0,
          assignmentsCompleted: 0,
          assignmentsTotal: 0,
          details: {
            lessons: lessons.length,
            activities: 0,
            assignments: 0,
          },
        };
      }

      const completionPercentage =
        totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

      return {
        completionPercentage: Math.round(completionPercentage * 100) / 100,
        isCompleted: completionPercentage >= 100,
        activitiesCompleted,
        activitiesTotal,
        assignmentsCompleted,
        assignmentsTotal,
        details: {
          lessons: lessons.length,
          activities: activitiesTotal,
          assignments: assignmentsTotal,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate course completion for student ${studentId}, course ${courseId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check if course is completed (shorthand)
   */
  async isCourseCompleted(
    studentId: string,
    courseId: string,
    classroomId?: string,
  ): Promise<boolean> {
    const completion = await this.calculateCourseCompletion(
      studentId,
      courseId,
      classroomId,
    );
    return completion.isCompleted;
  }
}












