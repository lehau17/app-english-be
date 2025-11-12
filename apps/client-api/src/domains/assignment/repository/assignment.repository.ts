import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import {
  Assignment,
  AssignmentStatus,
  AssignmentSubmission,
  AssignmentType,
  DifficultyLevel,
  Prisma,
  AssignmentActivity as PrismaAssignmentActivity,
} from '@prisma/client';
import { ActivityTypeValue } from '../../course/dto';

export type AssignmentActivityModel = PrismaAssignmentActivity;

export interface AssignmentWithDetails extends Assignment {
  teacher: {
    id: string;
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
  classroom: {
    id: string;
    name: string;
    classCode: string;
  };
  _count: {
    submissions: number;
  };
  assignmentActivities: AssignmentActivityModel[];
  submissions?: AssignmentSubmissionWithStudent[];
}

export interface AssignmentSubmissionWithStudent extends AssignmentSubmission {
  student: {
    id: string;
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
  assignment?: AssignmentWithDetails;
}

export interface AssignmentActivity {
  id: string;
  activityId?: string;
  type: ActivityTypeValue;
  title: string;
  instructions?: string;
  content: Record<string, any>;
  points: number;
  timeLimit?: number;
  maxAttempts?: number;
  passingScore?: number;
  difficulty?: DifficultyLevel;
  hints?: string[];
}

export interface CreateAssignmentData {
  teacherId: string;
  classroomId: string;
  title: string;
  description?: string;
  instructions?: string;
  dueDate?: Date;
  startTime?: Date;
  totalPoints?: number;
  timeLimit?: number;
  maxAttempts?: number;
  status?: AssignmentStatus;
  isPublished?: boolean;
  assignedTo?: string[];
  type?: AssignmentType;
  weight?: number | null;
  activities: AssignmentActivityInput[];
  customContent?: any;
}

export interface UpdateAssignmentData {
  title?: string;
  description?: string;
  instructions?: string;
  dueDate?: Date;
  startTime?: Date;
  totalPoints?: number;
  timeLimit?: number;
  maxAttempts?: number;
  status?: AssignmentStatus;
  isPublished?: boolean;
  assignedTo?: string[];
  type?: AssignmentType;
  weight?: number | null;
  activities?: AssignmentActivityInput[];
  customContent?: any;
}

type AssignmentActivityInput = {
  id: string;
  type: ActivityTypeValue;
  title: string;
  instructions?: string;
  content: Record<string, any>;
  points: number;
  timeLimit?: number;
  maxAttempts?: number;
  passingScore?: number;
  difficulty?: DifficultyLevel;
  hints?: string[];
};

@Injectable()
export class AssignmentRepository extends PrismaRepository {
  private assignmentInclude = {
    teacher: {
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    },
    classroom: {
      select: {
        id: true,
        name: true,
        classCode: true,
      },
    },
    assignmentActivities: {
      orderBy: {
        createdAt: 'asc',
      },
    },
    _count: {
      select: {
        submissions: true,
      },
    },
  } as const;

  async createAssignment(
    data: CreateAssignmentData,
  ): Promise<AssignmentWithDetails> {
    const { activities, ...assignmentData } = data;
    return this.assignment.create({
      data: {
        ...assignmentData,
        assignmentActivities: {
          create: activities.map((activity) =>
            this.mapActivityForNestedCreate(activity),
          ),
        },
      },
      include: this.assignmentInclude,
    });
  }

  async findAssignmentById(
    id: string,
    includeSubmissions = false,
  ): Promise<AssignmentWithDetails | null> {
    return this.assignment.findUnique({
      where: { id },
      include: {
        ...this.assignmentInclude,
        ...(includeSubmissions && {
          submissions: {
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
            orderBy: {
              submittedAt: 'desc',
            },
          },
        }),
      },
    });
  }

  async findAssignmentsByClassroom(
    classroomId: string,
    options?: {
      status?: AssignmentStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<{ assignments: AssignmentWithDetails[]; total: number }> {
    const { status, page = 1, limit = 20 } = options || {};
    const skip = (page - 1) * limit;

    const where: Prisma.AssignmentWhereInput = {
      classroomId,
      ...(status && { status }),
    };

    const [assignments, total] = await Promise.all([
      this.assignment.findMany({
        where,
        include: {
          ...this.assignmentInclude,
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.assignment.count({ where }),
    ]);

    return { assignments, total };
  }

  async findAssignmentsByTeacher(
    teacherId: string,
    options?: {
      classroomId?: string;
      status?: AssignmentStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<{ assignments: AssignmentWithDetails[]; total: number }> {
    const { classroomId, status, page = 1, limit = 20 } = options || {};
    const skip = (page - 1) * limit;

    const where: Prisma.AssignmentWhereInput = {
      teacherId,
      ...(classroomId && { classroomId }),
      ...(status && { status }),
    };

    const [assignments, total] = await Promise.all([
      this.assignment.findMany({
        where,
        include: {
          ...this.assignmentInclude,
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.assignment.count({ where }),
    ]);

    return { assignments, total };
  }

  async updateAssignment(
    id: string,
    data: UpdateAssignmentData,
  ): Promise<AssignmentWithDetails> {
    const { activities, ...assignmentData } = data;

    return this.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id },
        data: assignmentData,
      });

      if (activities) {
        await tx.assignmentActivity.deleteMany({ where: { assignmentId: id } });
        if (activities.length > 0) {
          await tx.assignmentActivity.createMany({
            data: activities.map((activity) =>
              this.mapActivityForCreate(activity, id),
            ),
          });
        }
      }

      return tx.assignment.findUnique({
        where: { id },
        include: this.assignmentInclude,
      }) as Promise<AssignmentWithDetails>;
    });
  }

  async deleteAssignment(id: string): Promise<void> {
    await this.assignment.delete({
      where: { id },
    });
  }

  async publishAssignment(id: string): Promise<AssignmentWithDetails> {
    return this.updateAssignment(id, {
      isPublished: true,
      status: AssignmentStatus.published,
    });
  }

  private mapActivityForCreate(
    activity: AssignmentActivityInput,
    assignmentId: string,
  ) {
    return {
      id: activity.id,
      assignmentId,
      type: activity.type,
      title: activity.title,
      instructions: activity.instructions,
      content: activity.content,
      points: activity.points ?? 10,
      timeLimit: activity.timeLimit,
      maxAttempts: activity.maxAttempts,
      passingScore: activity.passingScore,
      difficulty: activity.difficulty,
      hints: activity.hints ?? [],
    };
  }

  private mapActivityForNestedCreate(activity: AssignmentActivityInput) {
    return {
      id: activity.id,
      type: activity.type,
      title: activity.title,
      instructions: activity.instructions,
      content: activity.content,
      points: activity.points ?? 10,
      timeLimit: activity.timeLimit,
      maxAttempts: activity.maxAttempts,
      passingScore: activity.passingScore,
      difficulty: activity.difficulty,
      hints: activity.hints ?? [],
    };
  }

  // Submission methods
  async submitAssignment(data: {
    assignmentId: string;
    studentId: string;
    answers: any;
    timeSpent?: number;
    attemptCount?: number;
  }): Promise<AssignmentSubmissionWithStudent> {
    return this.assignmentSubmission.create({
      data: {
        assignmentId: data.assignmentId,
        studentId: data.studentId,
        answers: data.answers,
        timeSpent: data.timeSpent,
        attemptCount: data.attemptCount || 1,
        status: 'submitted',
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

  async gradeSubmission(
    submissionId: string,
    data: {
      score: number;
      feedback?: string;
    },
  ): Promise<AssignmentSubmissionWithStudent> {
    return this.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score: data.score,
        feedback: data.feedback,
        gradedAt: new Date(),
        status: 'graded',
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

  async findSubmissionByAssignmentAndStudent(
    assignmentId: string,
    studentId: string,
    attemptCount?: number,
  ): Promise<AssignmentSubmissionWithStudent | null> {
    const where: Prisma.AssignmentSubmissionWhereInput = {
      assignmentId,
      studentId,
      ...(attemptCount && { attemptCount }),
    };

    return this.assignmentSubmission.findFirst({
      where,
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
        assignment: {
          include: this.assignmentInclude,
        },
      },
      orderBy: {
        attemptCount: 'desc',
      },
    });
  }

  async findAllSubmissionsByAssignmentAndStudent(
    assignmentId: string,
    studentId: string,
  ): Promise<AssignmentSubmissionWithStudent[]> {
    return this.assignmentSubmission.findMany({
      where: {
        assignmentId,
        studentId,
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
        assignment: {
          include: this.assignmentInclude,
        },
      },
      orderBy: {
        attemptCount: 'asc',
      },
    });
  }

  async getSubmissionsByAssignment(
    assignmentId: string,
  ): Promise<AssignmentSubmissionWithStudent[]> {
    return this.assignmentSubmission.findMany({
      where: { assignmentId },
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
      orderBy: [{ submittedAt: 'desc' }],
    });
  }

  // ==================== GRADING METHODS ====================

  async findSubmissionWithDetails(submissionId: string): Promise<any> {
    return this.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        assignment: {
          include: {
            classroom: {
              select: {
                id: true,
                name: true,
                teacherId: true,
              },
            },
          },
        },
        gradedBy: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findTeacherById(teacherId: string): Promise<any> {
    return this.user.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        role: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  async updateSubmission(
    submissionId: string,
    data: {
      score?: number;
      feedback?: string | null;
      gradedAt?: Date;
      gradedById?: string;
      status?: string;
    },
  ): Promise<any> {
    return this.assignmentSubmission.update({
      where: { id: submissionId },
      data,
      include: {
        student: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            totalPoints: true,
          },
        },
      },
    });
  }
}
