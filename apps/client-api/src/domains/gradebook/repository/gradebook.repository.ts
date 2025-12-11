import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { AssignmentType } from '@prisma/client';

@Injectable()
export class GradebookRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Get midterm exam score for student in classroom
   */
  async getMidtermScore(
    studentId: string,
    classroomId: string,
  ): Promise<number | null> {
    const submission = await this.prisma.assignmentSubmission.findFirst({
      where: {
        studentId,
        assignment: {
          classroomId,
          type: AssignmentType.MIDTERM_EXAM,
        },
        score: { not: null },
      },
      orderBy: { submittedAt: 'desc' },
      select: { score: true },
    });

    return submission?.score ?? null;
  }

  /**
   * Get final exam score for student in classroom
   */
  async getFinalScore(
    studentId: string,
    classroomId: string,
  ): Promise<number | null> {
    const submission = await this.prisma.assignmentSubmission.findFirst({
      where: {
        studentId,
        assignment: {
          classroomId,
          type: AssignmentType.FINAL_EXAM,
        },
        score: { not: null },
      },
      orderBy: { submittedAt: 'desc' },
      select: { score: true },
    });

    return submission?.score ?? null;
  }

  /**
   * Get average score of all test assignments (excluding midterm and final)
   */
  async getTestScoresAverage(
    studentId: string,
    classroomId: string,
  ): Promise<number | null> {
    const submissions = await this.prisma.assignmentSubmission.findMany({
      where: {
        studentId,
        assignment: {
          classroomId,
          type: {
            notIn: [AssignmentType.MIDTERM_EXAM, AssignmentType.FINAL_EXAM],
          },
        },
        score: { not: null },
      },
      select: { score: true },
    });

    if (submissions.length === 0) {
      return null;
    }

    const scores = submissions
      .map((s) => s.score!)
      .filter((score) => score !== null);
    if (scores.length === 0) {
      return null;
    }

    const sum = scores.reduce((acc, score) => acc + score, 0);
    return Math.round((sum / scores.length) * 10) / 10;
  }

  /**
   * Get average activity score from Progress model for all lesson activities in course
   */
  async getActivityScoresAverage(
    studentId: string,
    courseId: string,
  ): Promise<number | null> {
    const progressRecords = await this.prisma.progress.findMany({
      where: {
        userId: studentId,
        activity: {
          lesson: {
            courseId,
          },
        },
        bestScore: { not: null },
      },
      select: { bestScore: true },
    });

    if (progressRecords.length === 0) {
      return null;
    }

    const scores = progressRecords
      .map((p) => p.bestScore!)
      .filter((score) => score !== null);
    if (scores.length === 0) {
      return null;
    }

    const sum = scores.reduce((acc, score) => acc + score, 0);
    return Math.round((sum / scores.length) * 10) / 10;
  }

  /**
   * Get all students in a classroom
   */
  async getClassroomStudents(classroomId: string) {
    return this.prisma.classroomStudent.findMany({
      where: {
        classroomId,
        isActive: true,
      },
      include: {
        student: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get classroom with course info
   */
  async getClassroomWithCourse(classroomId: string) {
    return this.prisma.classroom.findUnique({
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
  }

  /**
   * Get all classrooms for a student
   */
  async getStudentClassrooms(studentId: string) {
    return this.prisma.classroomStudent.findMany({
      where: {
        studentId,
        isActive: true,
      },
      include: {
        student: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        classroom: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get all children of a parent
   */
  async getParentChildren(parentId: string) {
    return this.prisma.parentChild.findMany({
      where: { parentId },
      include: {
        child: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get all assignments with submissions for a student in a classroom
   */
  async getStudentAssignments(
    studentId: string,
    classroomId: string,
  ): Promise<
    Array<{
      assignment: {
        id: string;
        title: string;
        type: AssignmentType;
        totalPoints: number;
        weight: number;
      };
      submission: {
        id: string;
        score: number | null;
        submittedAt: Date | null;
        gradedAt: Date | null;
        feedback: string | null;
        attemptCount: number;
      } | null;
    }>
  > {
    const assignments = await this.prisma.assignment.findMany({
      where: {
        classroomId,
        isPublished: true,
      },
      select: {
        id: true,
        title: true,
        type: true,
        totalPoints: true,
        weight: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const assignmentsWithSubmissions = await Promise.all(
      assignments.map(async (assignment) => {
        const submission = await this.prisma.assignmentSubmission.findFirst({
          where: {
            assignmentId: assignment.id,
            studentId,
          },
          orderBy: { submittedAt: 'desc' },
          select: {
            id: true,
            score: true,
            submittedAt: true,
            gradedAt: true,
            feedback: true,
            attemptCount: true,
          },
        });

        return {
          assignment,
          submission,
        };
      }),
    );

    return assignmentsWithSubmissions;
  }

  /**
   * Get all activities with progress for a student in a course
   */
  async getStudentActivities(
    studentId: string,
    courseId: string,
  ): Promise<
    Array<{
      activity: {
        id: string;
        title: string;
        type: string;
      };
      lesson: {
        title: string;
      };
      progress: {
        bestScore: number | null;
        score: number | null;
        attemptsCount: number;
        state: string;
        timeSpentSec: number;
      } | null;
    }>
  > {
    const activities = await this.prisma.activity.findMany({
      where: {
        lesson: {
          courseId,
        },
      },
      select: {
        id: true,
        title: true,
        type: true,
        lesson: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        orderNo: 'asc',
      },
    });

    const activitiesWithProgress = await Promise.all(
      activities.map(async (activity) => {
        const progress = await this.prisma.progress.findUnique({
          where: {
            userId_activityId: {
              userId: studentId,
              activityId: activity.id,
            },
          },
          select: {
            bestScore: true,
            score: true,
            attemptsCount: true,
            state: true,
            timeSpentSec: true,
          },
        });

        return {
          activity: {
            id: activity.id,
            title: activity.title,
            type: activity.type,
          },
          lesson: activity.lesson,
          progress,
        };
      }),
    );

    return activitiesWithProgress;
  }
}













