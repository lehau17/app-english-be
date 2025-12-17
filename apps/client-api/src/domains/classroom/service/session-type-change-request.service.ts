import { PrismaRepository } from '@app/database';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  SessionType,
  SessionTypeChangeStatus,
  NotificationType,
} from '@prisma/client';
import { NotificationService } from '../../notification/service/notification.service';
import { ClassroomService } from './classroom.service';
import {
  CreateSessionTypeChangeRequestDto,
  ReviewSessionTypeChangeRequestDto,
  QuerySessionTypeChangeRequestDto,
} from '../dto/session-type-change.dto';

@Injectable()
export class SessionTypeChangeRequestService {
  private readonly logger = new Logger(SessionTypeChangeRequestService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ClassroomService))
    private readonly classroomService: ClassroomService,
  ) {}

  /**
   * Create a new session type change request
   * Only teacher who owns the session can create request
   */
  async createRequest(
    sessionId: string,
    teacherId: string,
    dto: CreateSessionTypeChangeRequestDto,
  ) {
    // Get session and verify ownership
    const session = await this.prisma.classroomSession.findUnique({
      where: { id: sessionId },
      include: {
        classroom: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.instructorId !== teacherId) {
      throw new ForbiddenException(
        'Only the session instructor can create type change request',
      );
    }

    // Check if requested type is same as current
    if (session.type === dto.requestedType) {
      throw new BadRequestException(
        `Session is already ${dto.requestedType} type`,
      );
    }

    // Check if there's already a pending request for this session
    const existingPending =
      await this.prisma.sessionTypeChangeRequest.findFirst({
        where: {
          sessionId,
          status: SessionTypeChangeStatus.pending,
        },
      });

    if (existingPending) {
      throw new ConflictException(
        'There is already a pending type change request for this session',
      );
    }

    // Create request
    const request = await this.prisma.sessionTypeChangeRequest.create({
      data: {
        sessionId,
        requestedById: teacherId,
        currentType: session.type,
        requestedType: dto.requestedType,
        reason: dto.reason,
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        session: {
          select: {
            id: true,
            title: true,
            startTime: true,
            classroom: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Event-based notification (placeholder for future event emitter integration)
    // TODO: Emit event when EventEmitter2 is integrated
    // this.eventEmitter.emit('session-type-change-request.created', {...});

    // Send notification to admins
    await this.notifyAdmins(request);

    this.logger.log(
      `Created session type change request ${request.id} for session ${sessionId}`,
    );

    return this.mapToResponseDto(request);
  }

  /**
   * Get request by ID
   */
  async getRequestById(requestId: string) {
    const request = await this.prisma.sessionTypeChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        requestedBy: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        session: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            type: true,
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
      },
    });

    if (!request) {
      throw new NotFoundException('Type change request not found');
    }

    return this.mapToResponseDto(request);
  }

  /**
   * Get all requests for a session
   */
  async getRequestsBySession(
    sessionId: string,
    query: QuerySessionTypeChangeRequestDto,
  ) {
    const where: any = { sessionId };

    if (query.status) {
      where.status = query.status;
    }

    const requests = await this.prisma.sessionTypeChangeRequest.findMany({
      where,
      include: {
        requestedBy: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => this.mapToResponseDto(r));
  }

  /**
   * Get all requests (Admin) - with optional status filter
   */
  async getAllRequests(query: QuerySessionTypeChangeRequestDto) {
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      this.prisma.sessionTypeChangeRequest.findMany({
        where,
        include: {
          requestedBy: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
            },
          },
          session: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              type: true,
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sessionTypeChangeRequest.count({ where }),
    ]);

    return {
      data: requests.map((r) => this.mapToResponseDto(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all requests by teacher
   */
  async getRequestsByTeacher(
    teacherId: string,
    query: QuerySessionTypeChangeRequestDto,
  ) {
    const where: any = { requestedById: teacherId };

    if (query.status) {
      where.status = query.status;
    }

    const requests = await this.prisma.sessionTypeChangeRequest.findMany({
      where,
      include: {
        requestedBy: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        session: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            type: true,
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
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => this.mapToResponseDto(r));
  }

  /**
   * Get all pending requests (for admin)
   */
  async getPendingRequests() {
    const requests = await this.prisma.sessionTypeChangeRequest.findMany({
      where: { status: SessionTypeChangeStatus.pending },
      include: {
        requestedBy: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        session: {
          select: {
            id: true,
            title: true,
            startTime: true,
            type: true,
            classroom: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => this.mapToResponseDto(r));
  }

  /**
   * Review (approve/reject) a request
   * Admin only
   */
  async reviewRequest(
    requestId: string,
    adminId: string,
    dto: ReviewSessionTypeChangeRequestDto,
  ) {
    const request = await this.prisma.sessionTypeChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        session: true,
        requestedBy: {
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

    if (!request) {
      throw new NotFoundException('Type change request not found');
    }

    if (request.status !== SessionTypeChangeStatus.pending) {
      throw new BadRequestException(
        `Request is not pending (current status: ${request.status})`,
      );
    }

    // Validate rejection note is required when rejecting
    if (
      dto.status === 'rejected' &&
      (!dto.reviewNote || !dto.reviewNote.trim())
    ) {
      throw new BadRequestException(
        'Review note is required when rejecting a request',
      );
    }

    const status =
      dto.status === 'approved'
        ? SessionTypeChangeStatus.approved
        : SessionTypeChangeStatus.rejected;

    // Update request
    const updatedRequest = await this.prisma.sessionTypeChangeRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewNote: dto.reviewNote,
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        session: {
          select: {
            id: true,
            title: true,
            startTime: true,
            type: true,
          },
        },
      },
    });

    // If approved, directly update session type
    if (status === SessionTypeChangeStatus.approved) {
      await this.classroomService.updateSessionType(
        updatedRequest.sessionId,
        adminId,
        {
          type: updatedRequest.requestedType,
          generateMeetLink: updatedRequest.requestedType === SessionType.online,
        },
      );

      this.logger.log(
        `Approved session type change request ${requestId}, session ${updatedRequest.sessionId} updated to ${updatedRequest.requestedType}`,
      );
    }

    // Send notification to teacher
    await this.notifyTeacher(updatedRequest);

    return this.mapToResponseDto(updatedRequest);
  }

  /**
   * Notify admins about new request
   */
  private async notifyAdmins(request: any) {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: 'admin' },
        select: { id: true },
      });

      const requesterName =
        request.requestedBy.displayName ||
        `${request.requestedBy.firstName || ''} ${request.requestedBy.lastName || ''}`.trim() ||
        request.requestedBy.email ||
        'Teacher';

      const sessionDate = request.session.startTime
        ? new Date(request.session.startTime).toLocaleString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '';

      for (const admin of admins) {
        await this.notificationService.create({
          userId: admin.id,
          type: NotificationType.assignment,
          title: 'New session type change request',
          body: `${requesterName} requested to change session "${request.session.title || 'Untitled'}" (${sessionDate}) from ${request.currentType} to ${request.requestedType}. Reason: ${request.reason.slice(0, 100)}${request.reason.length > 100 ? '...' : ''}`,
          data: JSON.stringify({
            type: 'session_type_change_request',
            requestId: request.id,
            sessionId: request.sessionId,
            classroomId: request.session.classroom.id,
            classroomName: request.session.classroom.name,
            currentType: request.currentType,
            requestedType: request.requestedType,
            requestedById: request.requestedById,
            requesterName,
            sessionTitle: request.session.title,
            sessionDate,
            reason: request.reason,
          }),
          channel: 'socket' as any,
        });
      }

      this.logger.log(`Sent notification to ${admins.length} admins`);
    } catch (error) {
      this.logger.error(
        `Failed to send admin notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Notify teacher about review decision
   */
  private async notifyTeacher(request: any) {
    try {
      const teacherId = request.requestedById;
      const isApproved = request.status === SessionTypeChangeStatus.approved;

      const title = isApproved
        ? 'Session type change request approved'
        : 'Session type change request rejected';

      const body = isApproved
        ? `Your request to change session "${request.session.title || 'Untitled'}" to ${request.requestedType} has been approved.`
        : `Your request to change session "${request.session.title || 'Untitled'}" has been rejected. ${request.reviewNote ? `Reason: ${request.reviewNote}` : ''}`;

      await this.notificationService.create({
        userId: teacherId,
        type: NotificationType.assignment,
        title,
        body,
        data: JSON.stringify({
          type: 'session_type_change_review',
          requestId: request.id,
          sessionId: request.sessionId,
          status: request.status,
          reviewNote: request.reviewNote,
        }),
        channel: 'socket' as any,
      });

      this.logger.log(`Sent review notification to teacher ${teacherId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send teacher notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Map database model to response DTO
   */
  private mapToResponseDto(request: any) {
    return {
      id: request.id,
      sessionId: request.sessionId,
      currentType: request.currentType,
      requestedType: request.requestedType,
      reason: request.reason,
      status: request.status,
      requestedBy: {
        id: request.requestedBy.id,
        name:
          request.requestedBy.displayName ||
          `${request.requestedBy.firstName || ''} ${request.requestedBy.lastName || ''}`.trim() ||
          'Unknown',
        email: request.requestedBy.email,
        avatarUrl: request.requestedBy.avatarUrl,
      },
      reviewedBy: request.reviewedBy
        ? {
            id: request.reviewedBy.id,
            name:
              request.reviewedBy.displayName ||
              `${request.reviewedBy.firstName || ''} ${request.reviewedBy.lastName || ''}`.trim() ||
              'Admin',
          }
        : undefined,
      reviewedAt: request.reviewedAt,
      reviewNote: request.reviewNote,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      session: request.session
        ? {
            id: request.session.id,
            title: request.session.title,
            startTime: request.session.startTime,
            endTime: request.session.endTime,
            type: request.session.type,
            classroomId: request.session.classroomId,
            classroom: request.session.classroom
              ? {
                  id: request.session.classroom.id,
                  name: request.session.classroom.name,
                  classCode: request.session.classroom.classCode,
                }
              : undefined,
          }
        : undefined,
    };
  }
}
