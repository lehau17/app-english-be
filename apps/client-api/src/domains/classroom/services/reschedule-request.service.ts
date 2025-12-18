import { PrismaRepository } from '@app/database';
import { KafkaService } from '@app/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentType,
  NotificationChannel,
  NotificationType,
  SessionRescheduleRequestStatus,
} from '@prisma/client';
import { AssignmentRepository } from '../../assignment/repository/assignment.repository';
import { NotificationService } from '../../notification/service/notification.service';
import {
  CreateRescheduleRequestDto,
  QueryRescheduleRequestDto,
  ReviewRescheduleRequestDto,
  UpdateRescheduleRequestDto,
} from '../dto/reschedule-request.dto';
import { RescheduleRequestRepository } from '../repository/reschedule-request.repository';
import { HolidayService } from '../../holiday/holiday.service';

@Injectable()
export class RescheduleRequestService {
  private readonly logger = new Logger(RescheduleRequestService.name);

  constructor(
    private readonly rescheduleRequestRepository: RescheduleRequestRepository,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaRepository,
    private readonly assignmentRepository: AssignmentRepository,
    private readonly kafkaService?: KafkaService,
    private readonly holidayService?: HolidayService,
  ) { }

  /**
   * Create a new session reschedule request
   */
  async createRequest(
    sessionId: string,
    requestedById: string,
    dto: CreateRescheduleRequestDto,
  ) {
    // Validate new time is in the future
    const now = new Date();
    if (dto.newStartTime <= now) {
      throw new BadRequestException('Thời gian mới phải trong tương lai');
    }

    if (dto.newEndTime <= dto.newStartTime) {
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu',
      );
    }

    // Get session and verify teacher owns it
    const session = await this.prisma.classroomSession.findUnique({
      where: { id: sessionId },
      include: {
        classroom: {
          select: {
            id: true,
            name: true,
            teacherId: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy buổi học');
    }

    if (session.instructorId !== requestedById) {
      throw new ForbiddenException(
        'Chỉ giáo viên của buổi học mới có thể tạo yêu cầu dời lịch',
      );
    }

    // Check if there's already a pending request for this session
    const existing =
      await this.rescheduleRequestRepository.findPendingBySession(sessionId);
    if (existing) {
      throw new ConflictException(
        'Đã có yêu cầu dời lịch đang chờ duyệt cho buổi học này',
      );
    }

    // Validate time window (7:00 AM - 10:00 PM)
    const timeWindowValidation = this.validateTimeWindow(
      dto.newStartTime,
      dto.newEndTime,
    );
    if (!timeWindowValidation.isValid) {
      this.logger.warn(
        `Time window validation failed: ${timeWindowValidation.message}`,
        {
          sessionId,
          requestedById,
          newStartTime: dto.newStartTime,
          newEndTime: dto.newEndTime,
        },
      );
      throw new BadRequestException(timeWindowValidation.message);
    }

    // Validate classroom period
    const periodValidation = await this.validateClassroomPeriod(
      session.classroomId,
      dto.newStartTime,
      dto.newEndTime,
    );
    if (!periodValidation.isValid) {
      this.logger.warn(
        `Classroom period validation failed: ${periodValidation.message}`,
        {
          sessionId,
          classroomId: session.classroomId,
          newStartTime: dto.newStartTime,
          newEndTime: dto.newEndTime,
        },
      );
      throw new BadRequestException(periodValidation.message);
    }

    // Validate exam date
    await this.validateExamDate(session.classroomId, dto.newStartTime);

    // Validate holiday
    if (this.holidayService) {
      const isHoliday = await this.holidayService.isHoliday(dto.newStartTime);
      if (isHoliday) {
        throw new BadRequestException(
          'Không thể dời lịch vào ngày lễ. Vui lòng chọn ngày khác.',
        );
      }
    }

    // Check availability conflicts
    const conflicts = await this.checkAvailabilityConflicts(
      session.instructorId,
      session.classroomId,
      dto.newStartTime,
      dto.newEndTime,
      sessionId, // Exclude current session from conflict check
    );

    if (conflicts.hasConflicts) {
      throw new ConflictException(`Không thể dời lịch: ${conflicts.message}`);
    }

    // Create the request
    const request = await this.rescheduleRequestRepository.create({
      sessionId,
      requestedById,
      newStartTime: dto.newStartTime,
      newEndTime: dto.newEndTime,
      reason: dto.reason,
      evidenceUrls: dto.evidenceUrls,
    });

    // Send notification to admin
    await this.notifyAdmin(
      sessionId,
      requestedById,
      request.id,
      dto.reason,
      session,
    );

    return request;
  }

  /**
   * Notify admin about new reschedule request
   */
  private async notifyAdmin(
    sessionId: string,
    requestedById: string,
    requestId: string,
    reason: string,
    session: any,
  ) {
    try {
      // Get requester info
      const requester = await this.prisma.user.findUnique({
        where: { id: requestedById },
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      const requesterName =
        requester?.displayName ||
        `${requester?.firstName || ''} ${requester?.lastName || ''}`.trim() ||
        requester?.email ||
        'Giáo viên';

      const sessionDate = session.startTime
        ? new Date(session.startTime).toLocaleDateString('vi-VN', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        : '';

      // Find all admins
      const admins = await this.prisma.user.findMany({
        where: {
          role: 'admin',
        },
        select: {
          id: true,
        },
      });

      // Send notification to all admins
      for (const admin of admins) {
        await this.notificationService.create({
          userId: admin.id,
          type: NotificationType.assignment,
          title: 'Yêu cầu dời lịch buổi học mới',
          body: `${requesterName} đã gửi yêu cầu dời lịch cho buổi học "${session.title || 'Không có tiêu đề'}" (${sessionDate}). Lý do: ${reason.slice(0, 100)}${reason.length > 100 ? '...' : ''}`,
          data: JSON.stringify({
            type: 'session_reschedule_request',
            requestId,
            sessionId,
            classroomId: session.classroom.id,
            classroomName: session.classroom.name,
            requestedById,
            requesterName,
            sessionTitle: session.title,
            sessionDate,
            reason,
          }),
          channel: 'socket' as any,
        });
      }

      this.logger.log(`Sent reschedule request notification to admins`);
    } catch (error) {
      this.logger.error(
        `Failed to send reschedule request notification: ${error.message}`,
        error.stack,
      );
      // Don't throw - notification failure shouldn't block request creation
    }
  }

  /**
   * Get reschedule request by ID
   */
  async getRequestById(id: string) {
    const request = await this.rescheduleRequestRepository.findById(id);
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu dời lịch');
    }
    return request;
  }

  /**
   * Get all requests for a session
   */
  async getSessionRequests(
    sessionId: string,
    query: QueryRescheduleRequestDto,
  ) {
    return this.rescheduleRequestRepository.findBySession(
      sessionId,
      query.status,
      query.page || 1,
      query.limit || 20,
    );
  }

  /**
   * Get all requests for a classroom
   */
  async getClassroomRequests(
    classroomId: string,
    query: QueryRescheduleRequestDto,
  ) {
    return this.rescheduleRequestRepository.findByClassroom(
      classroomId,
      query.status,
      query.page || 1,
      query.limit || 20,
    );
  }

  /**
   * Get all requests by a teacher (requester)
   */
  async getMyRequests(requestedById: string, query: QueryRescheduleRequestDto) {
    return this.rescheduleRequestRepository.findByRequester(
      requestedById,
      query.status,
      query.page || 1,
      query.limit || 20,
    );
  }

  /**
   * Get all requests (for admin) with optional status filter
   */
  async getAllRequests(query: QueryRescheduleRequestDto) {
    return this.rescheduleRequestRepository.findAll(
      query.status,
      query.page || 1,
      query.limit || 20,
    );
  }

  /**
   * Get all pending requests (for admin)
   */
  async getPendingRequests(query: QueryRescheduleRequestDto) {
    return this.rescheduleRequestRepository.findPending(
      query.page || 1,
      query.limit || 20,
    );
  }

  /**
   * Get pending request by sessionId for teacher
   */
  async getPendingRequestBySession(sessionId: string, teacherId: string) {
    const request =
      await this.rescheduleRequestRepository.findPendingBySession(sessionId);

    if (!request) {
      return null;
    }

    // Verify teacher owns the request
    if (request.requestedById !== teacherId) {
      throw new ForbiddenException('Bạn không có quyền xem yêu cầu này');
    }

    // Return with full details
    return this.rescheduleRequestRepository.findById(request.id);
  }

  /**
   * Update a pending reschedule request
   */
  async updateRequest(
    requestId: string,
    teacherId: string,
    dto: UpdateRescheduleRequestDto,
  ) {
    // Get existing request
    const request = await this.rescheduleRequestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu dời lịch');
    }

    // Verify teacher owns the request
    if (request.requestedById !== teacherId) {
      throw new ForbiddenException(
        'Chỉ người tạo yêu cầu mới có thể chỉnh sửa',
      );
    }

    // Verify status is pending
    if (request.status !== SessionRescheduleRequestStatus.pending) {
      throw new BadRequestException(
        `Chỉ có thể chỉnh sửa yêu cầu đang chờ duyệt (hiện tại: ${request.status})`,
      );
    }

    // Prepare update data
    const updateData: {
      newStartTime?: Date;
      newEndTime?: Date;
      reason?: string;
      evidenceUrls?: string[];
    } = {};

    if (dto.newStartTime) {
      updateData.newStartTime = dto.newStartTime;
    }
    if (dto.newEndTime) {
      updateData.newEndTime = dto.newEndTime;
    }
    if (dto.reason) {
      updateData.reason = dto.reason;
    }
    if (dto.evidenceUrls !== undefined) {
      updateData.evidenceUrls = dto.evidenceUrls;
    }

    // If updating times, validate them
    const newStartTime = updateData.newStartTime || request.newStartTime;
    const newEndTime = updateData.newEndTime || request.newEndTime;

    // Validate new time is in the future (if times are being updated)
    if (updateData.newStartTime || updateData.newEndTime) {
      const now = new Date();
      if (newStartTime <= now) {
        throw new BadRequestException('Thời gian mới phải trong tương lai');
      }

      if (newEndTime <= newStartTime) {
        throw new BadRequestException(
          'Thời gian kết thúc phải sau thời gian bắt đầu',
        );
      }

      // Get session for validation
      const session = await this.prisma.classroomSession.findUnique({
        where: { id: request.sessionId },
        include: {
          classroom: {
            select: {
              id: true,
              name: true,
              teacherId: true,
              periodStart: true,
              periodEnd: true,
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundException('Không tìm thấy buổi học');
      }

      // Validate time window (7:00 - 22:00)
      const timeWindowValidation = this.validateTimeWindow(
        newStartTime,
        newEndTime,
      );
      if (!timeWindowValidation.isValid) {
        this.logger.warn(
          `Time window validation failed: ${timeWindowValidation.message}`,
          {
            requestId,
            teacherId,
            newStartTime,
            newEndTime,
          },
        );
        throw new BadRequestException(timeWindowValidation.message);
      }

      // Validate exam date
      await this.validateExamDate(session.classroomId, newStartTime);

      // Validate holiday
      if (this.holidayService) {
        const isHoliday = await this.holidayService.isHoliday(newStartTime);
        if (isHoliday) {
          throw new BadRequestException(
            'Không thể dời lịch vào ngày lễ. Vui lòng chọn ngày khác.',
          );
        }
      }

      // Validate classroom period
      const periodValidation = await this.validateClassroomPeriod(
        session.classroomId,
        newStartTime,
        newEndTime,
      );
      if (!periodValidation.isValid) {
        this.logger.warn(
          `Classroom period validation failed: ${periodValidation.message}`,
          {
            requestId,
            classroomId: session.classroomId,
            newStartTime,
            newEndTime,
          },
        );
        throw new BadRequestException(periodValidation.message);
      }

      // Check availability conflicts
      const conflicts = await this.checkAvailabilityConflicts(
        session.instructorId,
        session.classroomId,
        newStartTime,
        newEndTime,
        request.sessionId, // Exclude current session
      );

      if (conflicts.hasConflicts) {
        throw new ConflictException(`Không thể dời lịch: ${conflicts.message}`);
      }
    }

    // Update the request
    const updatedRequest = await this.rescheduleRequestRepository.update(
      requestId,
      updateData,
    );

    this.logger.log(
      `Updated reschedule request ${requestId} by teacher ${teacherId}`,
    );

    return updatedRequest;
  }

  /**
   * Review (approve/reject) a reschedule request
   */
  async reviewRequest(
    requestId: string,
    reviewerId: string,
    dto: ReviewRescheduleRequestDto,
  ) {
    const request = await this.rescheduleRequestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu dời lịch');
    }

    if (request.status !== SessionRescheduleRequestStatus.pending) {
      throw new BadRequestException(
        `Yêu cầu không ở trạng thái chờ duyệt (hiện tại: ${request.status})`,
      );
    }

    // Validate rejection reason is required when rejecting
    if (!dto.approved && (!dto.reviewNote || !dto.reviewNote.trim())) {
      throw new BadRequestException(
        'Lý do từ chối là bắt buộc khi từ chối yêu cầu dời lịch',
      );
    }

    const status = dto.approved
      ? SessionRescheduleRequestStatus.approved
      : SessionRescheduleRequestStatus.rejected;

    const updatedRequest = await this.rescheduleRequestRepository.review(
      requestId,
      reviewerId,
      status,
      dto.reviewNote,
    );

    // If approved, update the session and send notifications
    if (status === SessionRescheduleRequestStatus.approved) {
      await this.updateSessionTime(
        request.sessionId,
        request.newStartTime,
        request.newEndTime,
      );

      // Send email, in-app, and push notifications to students and parents
      await this.sendRescheduleNotifications(updatedRequest);
    }

    return updatedRequest;
  }

  /**
   * Send email notifications to students and parents about reschedule
   */
  private async sendRescheduleNotifications(request: any) {
    if (!this.kafkaService) {
      this.logger.warn(
        'KafkaService not available, skipping email notifications',
      );
      return;
    }

    try {
      // Get session with classroom info (use session from request if available, otherwise fetch)
      let session = request.session;
      if (!session || !session.classroom) {
        session = await this.prisma.classroomSession.findUnique({
          where: { id: request.sessionId },
          include: {
            classroom: {
              select: {
                id: true,
                name: true,
              },
            },
            instructor: {
              select: {
                displayName: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });
      }

      if (!session) {
        this.logger.warn(
          `Session ${request.sessionId} not found for notifications`,
        );
        return;
      }

      const teacherName =
        session.instructor?.displayName ||
        `${session.instructor?.firstName || ''} ${session.instructor?.lastName || ''}`.trim() ||
        'Giáo viên';

      const oldStartTime = session.startTime
        ? new Date(session.startTime).toLocaleString('vi-VN', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
        : 'N/A';

      const oldEndTime = session.endTime
        ? new Date(session.endTime).toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        })
        : 'N/A';

      const newStartTime = new Date(request.newStartTime).toLocaleString(
        'vi-VN',
        {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        },
      );

      const newEndTime = new Date(request.newEndTime).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const classroomUrl = `${process.env.APP_URL || 'http://localhost:3000'}/classrooms/${session.classroomId}`;

      // Get all students in the classroom
      const classroomStudents = await this.prisma.classroomStudent.findMany({
        where: {
          classroomId: session.classroomId,
          isActive: true,
        },
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
        },
      });

      // Send notifications to each student
      for (const enrollment of classroomStudents) {
        const student = enrollment.student;
        if (!student) continue;

        const studentName =
          student.displayName ||
          `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
          'Học viên';

        // Create in-app notification for student
        await this.notificationService.create({
          userId: student.id,
          type: NotificationType.system,
          title: 'Thông báo dời lịch buổi học',
          body: `Buổi học "${session.title}" đã được dời từ ${oldStartTime} sang ${newStartTime}`,
          channel: NotificationChannel.in_app,
          data: JSON.stringify({
            action: 'session_rescheduled',
            sessionId: request.sessionId,
            classroomId: session.classroomId,
            oldStartTime: session.startTime,
            oldEndTime: session.endTime,
            newStartTime: request.newStartTime,
            newEndTime: request.newEndTime,
            reason: request.reason,
            actionUrl: classroomUrl,
          }),
        });

        // Create push notification (FCM) for student
        await this.notificationService.create({
          userId: student.id,
          type: NotificationType.system,
          title: 'Thông báo dời lịch buổi học',
          body: `Buổi học "${session.title}" đã được dời sang ${newStartTime}`,
          channel: NotificationChannel.fcm,
          data: JSON.stringify({
            action: 'session_rescheduled',
            sessionId: request.sessionId,
            classroomId: session.classroomId,
            oldStartTime: session.startTime,
            oldEndTime: session.endTime,
            newStartTime: request.newStartTime,
            newEndTime: request.newEndTime,
            reason: request.reason,
            actionUrl: classroomUrl,
          }),
        });

        // Send email notification
        if (student.email) {
          await this.kafkaService.sendAsync('notifications', {
            type: 'session-reschedule-notification',
            userId: student.id,
            email: student.email,
            channel: 'email',
            template: 'session-reschedule-notification',
            data: {
              studentName,
              classroomName: session.classroom.name,
              sessionTitle: session.title,
              teacherName,
              oldStartTime,
              oldEndTime,
              newStartTime,
              newEndTime,
              reason: request.reason,
              classroomUrl,
            },
          });

          this.logger.log(
            `Email notification queued for student ${student.id}`,
          );
        }

        // Find and send to parents
        const parents = await this.findLinkedParents(student.id);
        for (const parent of parents) {
          if (!parent.email) continue;

          const childName =
            student.displayName ||
            `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
            'Con bạn';

          // Create in-app notification for parent
          await this.notificationService.create({
            userId: parent.id,
            type: NotificationType.parent_child,
            title: 'Thông báo dời lịch buổi học của con',
            body: `Buổi học "${session.title}" của ${childName} đã được dời từ ${oldStartTime} sang ${newStartTime}`,
            channel: NotificationChannel.in_app,
            data: JSON.stringify({
              action: 'session_rescheduled',
              childId: student.id,
              childName,
              sessionId: request.sessionId,
              classroomId: session.classroomId,
              oldStartTime: session.startTime,
              oldEndTime: session.endTime,
              newStartTime: request.newStartTime,
              newEndTime: request.newEndTime,
              reason: request.reason,
              actionUrl: classroomUrl,
            }),
          });

          // Create push notification (FCM) for parent
          await this.notificationService.create({
            userId: parent.id,
            type: NotificationType.parent_child,
            title: 'Thông báo dời lịch buổi học của con',
            body: `Buổi học "${session.title}" của ${childName} đã được dời sang ${newStartTime}`,
            channel: NotificationChannel.fcm,
            data: JSON.stringify({
              action: 'session_rescheduled',
              childId: student.id,
              childName,
              sessionId: request.sessionId,
              classroomId: session.classroomId,
              oldStartTime: session.startTime,
              oldEndTime: session.endTime,
              newStartTime: request.newStartTime,
              newEndTime: request.newEndTime,
              reason: request.reason,
              actionUrl: classroomUrl,
            }),
          });

          // Send email notification
          await this.kafkaService.sendAsync('notifications', {
            type: 'session-reschedule-notification',
            userId: parent.id,
            email: parent.email,
            channel: 'email',
            template: 'session-reschedule-notification',
            data: {
              studentName: childName,
              classroomName: session.classroom.name,
              sessionTitle: session.title,
              teacherName,
              oldStartTime,
              oldEndTime,
              newStartTime,
              newEndTime,
              reason: request.reason,
              classroomUrl,
            },
          });

          this.logger.log(`Email notification queued for parent ${parent.id}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to send reschedule notifications: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Find all linked parents for a student
   */
  private async findLinkedParents(
    studentId: string,
  ): Promise<Array<{ id: string; email: string | null }>> {
    try {
      const relations = await this.prisma.parentChild.findMany({
        where: {
          childId: studentId,
        },
        include: {
          parent: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });
      return relations
        .map((r) => r.parent)
        .filter((p) => p !== null && p.email !== null);
    } catch (error) {
      this.logger.error(
        `Failed to find linked parents for student ${studentId}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Validate time window constraint (7:00 AM - 10:00 PM)
   */
  private validateTimeWindow(
    newStartTime: Date,
    newEndTime: Date,
  ): { isValid: boolean; message?: string } {
    const startDate = new Date(newStartTime);
    const endDate = new Date(newEndTime);

    // Get hours and minutes in local time (considering timezone)
    const startHour = startDate.getHours();
    const startMinute = startDate.getMinutes();
    const endHour = endDate.getHours();
    const endMinute = endDate.getMinutes();

    // Check start time >= 7:00 AM
    if (startHour < 7 || (startHour === 7 && startMinute < 0)) {
      return {
        isValid: false,
        message: 'Thời gian bắt đầu phải từ 7:00',
      };
    }

    // Check end time < 10:00 PM (22:00)
    if (endHour >= 22) {
      return {
        isValid: false,
        message: 'Thời gian kết thúc phải trước 10:00 PM (22:00)',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate that new times are within classroom's effective period
   */
  /**
   * Validate that the new date is not on an exam day
   */
  private async validateExamDate(
    classroomId: string,
    newStartTime: Date,
  ): Promise<void> {
    // Get all assignments for the classroom
    const { assignments } =
      await this.assignmentRepository.findAssignmentsByClassroom(classroomId);

    // Filter exam assignments (MIDTERM_EXAM, FINAL_EXAM)
    const examAssignments = assignments.filter(
      (assignment) =>
        assignment.type === AssignmentType.MIDTERM_EXAM ||
        assignment.type === AssignmentType.FINAL_EXAM,
    );

    if (examAssignments.length === 0) {
      return; // No exams, validation passes
    }

    // Check if newStartTime falls on any exam date
    const newDate = new Date(newStartTime);
    const newDateOnly = new Date(
      newDate.getFullYear(),
      newDate.getMonth(),
      newDate.getDate(),
    );

    for (const exam of examAssignments) {
      if (!exam.startTime) {
        continue;
      }

      const examStartDate = new Date(exam.startTime);
      const examStartDateOnly = new Date(
        examStartDate.getFullYear(),
        examStartDate.getMonth(),
        examStartDate.getDate(),
      );

      // Check if session date matches exam start date
      if (newDateOnly.getTime() === examStartDateOnly.getTime()) {
        const examTypeName =
          exam.type === AssignmentType.MIDTERM_EXAM ? 'giữa kỳ' : 'cuối kỳ';
        throw new BadRequestException(
          `Không thể xin dời lịch vào ngày thi ${examTypeName}. Vui lòng chọn ngày khác.`,
        );
      }

      // Check if exam has dueDate and session date matches exam end date
      if (exam.dueDate) {
        const examEndDate = new Date(exam.dueDate);
        const examEndDateOnly = new Date(
          examEndDate.getFullYear(),
          examEndDate.getMonth(),
          examEndDate.getDate(),
        );

        if (newDateOnly.getTime() === examEndDateOnly.getTime()) {
          const examTypeName =
            exam.type === AssignmentType.MIDTERM_EXAM ? 'giữa kỳ' : 'cuối kỳ';
          throw new BadRequestException(
            `Không thể xin dời lịch vào ngày thi ${examTypeName}. Vui lòng chọn ngày khác.`,
          );
        }

        // Check if session date falls within exam date range
        if (
          newDateOnly >= examStartDateOnly &&
          newDateOnly <= examEndDateOnly
        ) {
          const examTypeName =
            exam.type === AssignmentType.MIDTERM_EXAM ? 'giữa kỳ' : 'cuối kỳ';
          throw new BadRequestException(
            `Không thể xin dời lịch vào ngày thi ${examTypeName}. Vui lòng chọn ngày khác.`,
          );
        }
      }
    }
  }

  private async validateClassroomPeriod(
    classroomId: string,
    newStartTime: Date,
    newEndTime: Date,
  ): Promise<{ isValid: boolean; message?: string }> {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      select: {
        periodStart: true,
        periodEnd: true,
        name: true,
      },
    });

    if (!classroom) {
      return {
        isValid: false,
        message: 'Không tìm thấy lớp học',
      };
    }

    const periodStart = new Date(classroom.periodStart);
    const periodEnd = new Date(classroom.periodEnd);

    // Check newStartTime >= periodStart
    if (newStartTime < periodStart) {
      return {
        isValid: false,
        message: `Thời gian bắt đầu phải nằm trong khoảng thời gian hiệu lực của lớp học (từ ${periodStart.toLocaleString('vi-VN')} đến ${periodEnd.toLocaleString('vi-VN')})`,
      };
    }

    // Check newEndTime <= periodEnd
    if (newEndTime > periodEnd) {
      return {
        isValid: false,
        message: `Thời gian kết thúc phải nằm trong khoảng thời gian hiệu lực của lớp học (từ ${periodStart.toLocaleString('vi-VN')} đến ${periodEnd.toLocaleString('vi-VN')})`,
      };
    }

    return { isValid: true };
  }

  /**
   * Check availability conflicts for teacher and students
   */
  private async checkAvailabilityConflicts(
    teacherId: string,
    classroomId: string,
    newStartTime: Date,
    newEndTime: Date,
    excludeSessionId: string,
  ): Promise<{ hasConflicts: boolean; message: string }> {
    // Check for overlapping sessions in the same classroom
    const sameClassroomConflict = await this.prisma.classroomSession.findFirst({
      where: {
        classroomId,
        id: { not: excludeSessionId },
        status: { in: ['scheduled', 'ongoing'] },
        OR: [
          {
            startTime: { lt: newEndTime },
            endTime: { gt: newStartTime },
          },
        ],
      },
      include: {
        classroom: {
          select: {
            name: true,
          },
        },
      },
    });

    if (sameClassroomConflict) {
      return {
        hasConflicts: true,
        message: `Thời gian mới trùng với buổi học khác trong cùng lớp: "${sameClassroomConflict.title}" (${new Date(sameClassroomConflict.startTime).toLocaleString('vi-VN')})`,
      };
    }

    // Check teacher conflicts
    const teacherConflicts = await this.prisma.classroomSession.findFirst({
      where: {
        instructorId: teacherId,
        id: { not: excludeSessionId },
        status: { in: ['scheduled', 'ongoing'] },
        OR: [
          {
            startTime: { lt: newEndTime },
            endTime: { gt: newStartTime },
          },
        ],
      },
      include: {
        classroom: {
          select: {
            name: true,
          },
        },
      },
    });

    if (teacherConflicts) {
      return {
        hasConflicts: true,
        message: `Giáo viên đã có buổi học khác vào thời gian này: ${teacherConflicts.classroom.name} (${new Date(teacherConflicts.startTime).toLocaleString('vi-VN')})`,
      };
    }

    // Get all students in the classroom
    const classroomStudents = await this.prisma.classroomStudent.findMany({
      where: {
        classroomId,
        isActive: true,
      },
      select: {
        studentId: true,
      },
    });

    // Check conflicts for each student
    const studentConflicts: Array<{ studentId: string; sessionTitle: string }> =
      [];
    for (const enrollment of classroomStudents) {
      const conflict = await this.prisma.classroomSession.findFirst({
        where: {
          classroom: {
            students: {
              some: {
                studentId: enrollment.studentId,
                isActive: true,
              },
            },
          },
          id: { not: excludeSessionId },
          status: { in: ['scheduled', 'ongoing'] },
          OR: [
            {
              startTime: { lt: newEndTime },
              endTime: { gt: newStartTime },
            },
          ],
        },
        include: {
          classroom: {
            select: {
              name: true,
            },
          },
        },
      });

      if (conflict) {
        const student = await this.prisma.user.findUnique({
          where: { id: enrollment.studentId },
          select: {
            displayName: true,
            firstName: true,
            lastName: true,
          },
        });

        const studentName =
          student?.displayName ||
          `${student?.firstName || ''} ${student?.lastName || ''}`.trim() ||
          'Học viên';

        studentConflicts.push({
          studentId: enrollment.studentId,
          sessionTitle: `${studentName} - ${conflict.classroom.name}`,
        });
      }
    }

    if (studentConflicts.length > 0) {
      const conflictList = studentConflicts
        .slice(0, 3)
        .map((c) => c.sessionTitle)
        .join(', ');
      const moreCount =
        studentConflicts.length > 3
          ? ` và ${studentConflicts.length - 3} học viên khác`
          : '';

      return {
        hasConflicts: true,
        message: `Có ${studentConflicts.length} học viên bị trùng lịch: ${conflictList}${moreCount}`,
      };
    }

    return { hasConflicts: false, message: '' };
  }

  /**
   * Update session time
   */
  private async updateSessionTime(
    sessionId: string,
    newStartTime: Date,
    newEndTime: Date,
  ) {
    const durationHours =
      (newEndTime.getTime() - newStartTime.getTime()) / (1000 * 60 * 60);

    await this.prisma.classroomSession.update({
      where: { id: sessionId },
      data: {
        startTime: newStartTime,
        endTime: newEndTime,
        durationHours,
      },
    });

    this.logger.log(
      `Updated session ${sessionId} time to ${newStartTime} - ${newEndTime}`,
    );
  }

  /**
   * Cancel a pending request
   */
  async cancelRequest(id: string, requestedById: string) {
    const request = await this.rescheduleRequestRepository.findById(id);
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu dời lịch');
    }

    if (request.requestedById !== requestedById) {
      throw new ForbiddenException('Chỉ người tạo yêu cầu mới có thể hủy');
    }

    if (request.status !== SessionRescheduleRequestStatus.pending) {
      throw new BadRequestException('Chỉ có thể hủy yêu cầu đang chờ duyệt');
    }

    return this.rescheduleRequestRepository.delete(id);
  }
}
