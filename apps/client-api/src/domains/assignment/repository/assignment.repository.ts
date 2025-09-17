import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { Assignment, AssignmentStatus, AssignmentSubmission, Prisma } from '@prisma/client';

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
}

export interface CreateAssignmentData {
  teacherId: string;
  classroomId: string;
  title: string;
  description?: string;
  instructions?: string;
  dueDate?: Date;
  totalPoints?: number;
  timeLimit?: number;
  maxAttempts?: number;
  status?: AssignmentStatus;
  isPublished?: boolean;
  assignedTo?: string[];
  activities: any;
  customContent?: any;
}

export interface UpdateAssignmentData {
  title?: string;
  description?: string;
  instructions?: string;
  dueDate?: Date;
  totalPoints?: number;
  timeLimit?: number;
  maxAttempts?: number;
  status?: AssignmentStatus;
  isPublished?: boolean;
  assignedTo?: string[];
  activities?: any;
  customContent?: any;
}

@Injectable()
export class AssignmentRepository extends PrismaRepository {

  async createAssignment(data: CreateAssignmentData): Promise<AssignmentWithDetails> {
    return this.assignment.create({
      data,
      include: {
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
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });
  }

  async findAssignmentById(id: string, includeSubmissions = false): Promise<AssignmentWithDetails | null> {
    return this.assignment.findUnique({
      where: { id },
      include: {
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
        _count: {
          select: {
            submissions: true,
          },
        },
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
    }
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
          _count: {
            select: {
              submissions: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
        ],
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
    }
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
          _count: {
            select: {
              submissions: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.assignment.count({ where }),
    ]);

    return { assignments, total };
  }

  async updateAssignment(id: string, data: UpdateAssignmentData): Promise<AssignmentWithDetails> {
    return this.assignment.update({
      where: { id },
      data,
      include: {
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
        _count: {
          select: {
            submissions: true,
          },
        },
      },
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
    }
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
    attemptCount?: number
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
      },
      orderBy: {
        attemptCount: 'desc',
      },
    });
  }

  async getSubmissionsByAssignment(assignmentId: string): Promise<AssignmentSubmissionWithStudent[]> {
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
      orderBy: [
        { submittedAt: 'desc' },
      ],
    });
  }
}
