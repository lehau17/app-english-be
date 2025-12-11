import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { MakeupRequestStatus, Prisma } from '@prisma/client';

@Injectable()
export class MakeupRequestRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Create a new makeup attendance request
   */
  async create(data: {
    sessionId: string;
    studentId: string;
    reason: string;
    evidenceUrls?: string[];
  }) {
    return this.prisma.makeupAttendanceRequest.create({
      data: {
        sessionId: data.sessionId,
        studentId: data.studentId,
        reason: data.reason,
        evidenceUrls: data.evidenceUrls || [],
        status: MakeupRequestStatus.pending,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            email: true,
          },
        },
        session: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            classroomId: true,
          },
        },
      },
    });
  }

  /**
   * Find makeup request by id
   */
  async findById(id: string) {
    return this.prisma.makeupAttendanceRequest.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            email: true,
          },
        },
        session: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            classroomId: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });
  }

  /**
   * Find existing request for session/student
   */
  async findBySessionAndStudent(sessionId: string, studentId: string) {
    return this.prisma.makeupAttendanceRequest.findUnique({
      where: {
        sessionId_studentId: { sessionId, studentId },
      },
    });
  }

  /**
   * Find all requests for a session
   */
  async findBySession(
    sessionId: string,
    status?: MakeupRequestStatus,
    page = 1,
    limit = 20,
  ) {
    const where: Prisma.MakeupAttendanceRequestWhereInput = {
      sessionId,
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.makeupAttendanceRequest.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
              email: true,
            },
          },
          session: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              classroomId: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.makeupAttendanceRequest.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Find all requests for a classroom
   */
  async findByClassroom(
    classroomId: string,
    status?: MakeupRequestStatus,
    page = 1,
    limit = 20,
  ) {
    const where: Prisma.MakeupAttendanceRequestWhereInput = {
      session: { classroomId },
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.makeupAttendanceRequest.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
              email: true,
            },
          },
          session: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              classroomId: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.makeupAttendanceRequest.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Find all requests by a student
   */
  async findByStudent(
    studentId: string,
    status?: MakeupRequestStatus,
    page = 1,
    limit = 20,
    classroomId?: string,
  ) {
    const where: Prisma.MakeupAttendanceRequestWhereInput = {
      studentId,
      ...(status && { status }),
      ...(classroomId && {
        session: { classroomId },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.makeupAttendanceRequest.findMany({
        where,
        include: {
          session: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              classroomId: true,
              classroom: {
                select: {
                  id: true,
                  name: true,
                  classCode: true,
                },
              },
            },
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.makeupAttendanceRequest.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Update request status (approve/reject)
   */
  async review(
    id: string,
    reviewerId: string,
    status: MakeupRequestStatus,
    reviewNote?: string,
  ) {
    return this.prisma.makeupAttendanceRequest.update({
      where: { id },
      data: {
        status,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            email: true,
          },
        },
        session: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            classroomId: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });
  }

  /**
   * Delete a makeup request
   */
  async delete(id: string) {
    return this.prisma.makeupAttendanceRequest.delete({
      where: { id },
    });
  }
}
