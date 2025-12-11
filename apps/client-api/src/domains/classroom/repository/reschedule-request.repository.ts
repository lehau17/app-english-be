import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { Prisma, SessionRescheduleRequestStatus } from '@prisma/client';

@Injectable()
export class RescheduleRequestRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Create a new session reschedule request
   */
  async create(data: {
    sessionId: string;
    requestedById: string;
    newStartTime: Date;
    newEndTime: Date;
    reason: string;
    evidenceUrls?: string[];
  }) {
    return this.prisma.sessionRescheduleRequest.create({
      data: {
        sessionId: data.sessionId,
        requestedById: data.requestedById,
        newStartTime: data.newStartTime,
        newEndTime: data.newEndTime,
        reason: data.reason,
        evidenceUrls: data.evidenceUrls || [],
        status: SessionRescheduleRequestStatus.pending,
      },
      include: {
        requestedBy: {
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
            instructorId: true,
          },
        },
      },
    });
  }

  /**
   * Find reschedule request by id
   */
  async findById(id: string) {
    return this.prisma.sessionRescheduleRequest.findUnique({
      where: { id },
      include: {
        requestedBy: {
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
            instructorId: true,
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
   * Find existing pending request for session
   */
  async findPendingBySession(sessionId: string) {
    return this.prisma.sessionRescheduleRequest.findFirst({
      where: {
        sessionId,
        status: SessionRescheduleRequestStatus.pending,
      },
    });
  }

  /**
   * Find all requests for a session
   */
  async findBySession(
    sessionId: string,
    status?: SessionRescheduleRequestStatus,
    page = 1,
    limit = 20,
  ) {
    const where: Prisma.SessionRescheduleRequestWhereInput = {
      sessionId,
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.sessionRescheduleRequest.findMany({
        where,
        include: {
          requestedBy: {
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
              instructorId: true,
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
      this.prisma.sessionRescheduleRequest.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Find all requests for a classroom
   */
  async findByClassroom(
    classroomId: string,
    status?: SessionRescheduleRequestStatus,
    page = 1,
    limit = 20,
  ) {
    const where: Prisma.SessionRescheduleRequestWhereInput = {
      session: { classroomId },
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.sessionRescheduleRequest.findMany({
        where,
        include: {
          requestedBy: {
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
              instructorId: true,
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
      this.prisma.sessionRescheduleRequest.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Find all requests by a teacher (requester)
   */
  async findByRequester(
    requestedById: string,
    status?: SessionRescheduleRequestStatus,
    page = 1,
    limit = 20,
  ) {
    const where: Prisma.SessionRescheduleRequestWhereInput = {
      requestedById,
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.sessionRescheduleRequest.findMany({
        where,
        include: {
          session: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              classroomId: true,
              instructorId: true,
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
      this.prisma.sessionRescheduleRequest.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Find all requests (for admin) with optional status filter
   */
  async findAll(status?: SessionRescheduleRequestStatus, page = 1, limit = 20) {
    const where: Prisma.SessionRescheduleRequestWhereInput = {
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.sessionRescheduleRequest.findMany({
        where,
        include: {
          requestedBy: {
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
              instructorId: true,
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
      this.prisma.sessionRescheduleRequest.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Find all pending requests (for admin)
   */
  async findPending(page = 1, limit = 20) {
    const where: Prisma.SessionRescheduleRequestWhereInput = {
      status: SessionRescheduleRequestStatus.pending,
    };

    const [data, total] = await Promise.all([
      this.prisma.sessionRescheduleRequest.findMany({
        where,
        include: {
          requestedBy: {
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
              instructorId: true,
              classroom: {
                select: {
                  id: true,
                  name: true,
                  classCode: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sessionRescheduleRequest.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Update request status (approve/reject)
   */
  async review(
    id: string,
    reviewerId: string,
    status: SessionRescheduleRequestStatus,
    reviewNote?: string,
  ) {
    return this.prisma.sessionRescheduleRequest.update({
      where: { id },
      data: {
        status,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote,
      },
      include: {
        requestedBy: {
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
            instructorId: true,
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
   * Update a reschedule request
   */
  async update(
    id: string,
    data: {
      newStartTime?: Date;
      newEndTime?: Date;
      reason?: string;
      evidenceUrls?: string[];
    },
  ) {
    return this.prisma.sessionRescheduleRequest.update({
      where: { id },
      data: {
        ...(data.newStartTime && { newStartTime: data.newStartTime }),
        ...(data.newEndTime && { newEndTime: data.newEndTime }),
        ...(data.reason && { reason: data.reason }),
        ...(data.evidenceUrls !== undefined && {
          evidenceUrls: data.evidenceUrls,
        }),
      },
      include: {
        requestedBy: {
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
            instructorId: true,
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
   * Delete a reschedule request
   */
  async delete(id: string) {
    return this.prisma.sessionRescheduleRequest.delete({
      where: { id },
    });
  }
}
