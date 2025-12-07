import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaRepository } from '@app/database';
import { MakeupRequestRepository } from '../repository/makeup-request.repository';
import { AttendanceRepository, AttendanceStatus } from '../repository/attendance.repository';
import { NotificationService } from '../../notification/service/notification.service';
import {
    CreateMakeupRequestDto,
    ReviewMakeupRequestDto,
    QueryMakeupRequestDto,
} from '../dto/makeup-request.dto';

// Local enum until Prisma generates
enum MakeupRequestStatusLocal {
    pending = 'pending',
    approved = 'approved',
    rejected = 'rejected',
}

@Injectable()
export class MakeupRequestService {
    private readonly logger = new Logger(MakeupRequestService.name);

    constructor(
        private readonly makeupRequestRepository: MakeupRequestRepository,
        private readonly attendanceRepository: AttendanceRepository,
        private readonly notificationService: NotificationService,
        private readonly prisma: PrismaRepository,
    ) { }

    /**
     * Create a new makeup attendance request
     */
    async createRequest(
        sessionId: string,
        studentId: string,
        dto: CreateMakeupRequestDto,
    ) {
        // Check if request already exists
        const existing = await this.makeupRequestRepository.findBySessionAndStudent(
            sessionId,
            studentId,
        );
        if (existing) {
            throw new ConflictException(
                'Bạn đã gửi yêu cầu điểm danh bù cho buổi học này',
            );
        }

        // Create the request
        const request = await this.makeupRequestRepository.create({
            sessionId,
            studentId,
            reason: dto.reason,
            evidenceUrls: dto.evidenceUrls,
        });

        // Send notification to teacher
        await this.notifyTeacher(sessionId, studentId, request.id, dto.reason);

        return request;
    }

    /**
     * Notify teacher about new makeup request
     */
    private async notifyTeacher(
        sessionId: string,
        studentId: string,
        requestId: string,
        reason: string,
    ) {
        try {
            // Get session with classroom and teacher info
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

            if (!session?.classroom?.teacherId) {
                this.logger.warn(`No teacher found for session ${sessionId}`);
                return;
            }

            // Get student info
            const student = await this.prisma.user.findUnique({
                where: { id: studentId },
                select: {
                    displayName: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            });

            const studentName = student?.displayName
                || `${student?.firstName || ''} ${student?.lastName || ''}`.trim()
                || student?.email
                || 'Học viên';

            const sessionDate = session.startTime
                ? new Date(session.startTime).toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                })
                : '';

            // Send notification to teacher
            await this.notificationService.create({
                userId: session.classroom.teacherId,
                type: NotificationType.assignment,
                title: 'Yêu cầu điểm danh bù mới',
                body: `${studentName} đã gửi yêu cầu điểm danh bù cho buổi học "${session.title || 'Không có tiêu đề'}" (${sessionDate}). Lý do: ${reason.slice(0, 100)}${reason.length > 100 ? '...' : ''}`,
                data: JSON.stringify({
                    type: 'makeup_attendance_request',
                    requestId,
                    sessionId,
                    classroomId: session.classroom.id,
                    classroomName: session.classroom.name,
                    studentId,
                    studentName,
                    sessionTitle: session.title,
                    sessionDate,
                    reason,
                }),
                channel: 'socket' as any,
            });

            this.logger.log(`Sent makeup request notification to teacher ${session.classroom.teacherId}`);
        } catch (error) {
            this.logger.error(`Failed to send makeup request notification: ${error.message}`, error.stack);
            // Don't throw - notification failure shouldn't block request creation
        }
    }

    /**
     * Get makeup request by ID
     */
    async getRequestById(id: string) {
        const request = await this.makeupRequestRepository.findById(id);
        if (!request) {
            throw new NotFoundException('Không tìm thấy yêu cầu điểm danh bù');
        }
        return request;
    }

    /**
     * Get all requests for a session
     */
    async getSessionRequests(sessionId: string, query: QueryMakeupRequestDto) {
        return this.makeupRequestRepository.findBySession(
            sessionId,
            query.status as any,
            query.page || 1,
            query.limit || 20,
        );
    }

    /**
     * Get all requests for a classroom
     */
    async getClassroomRequests(
        classroomId: string,
        query: QueryMakeupRequestDto,
    ) {
        return this.makeupRequestRepository.findByClassroom(
            classroomId,
            query.status as any,
            query.page || 1,
            query.limit || 20,
        );
    }

    /**
     * Get all requests by a student
     */
    async getMyRequests(studentId: string, query: QueryMakeupRequestDto) {
        return this.makeupRequestRepository.findByStudent(
            studentId,
            query.status as any,
            query.page || 1,
            query.limit || 20,
        );
    }

    /**
     * Review (approve/reject) a makeup request
     */
    async reviewRequest(
        requestId: string,
        reviewerId: string,
        dto: ReviewMakeupRequestDto,
    ) {
        const request = await this.makeupRequestRepository.findById(requestId);

        if (!request) {
            throw new NotFoundException('Không tìm thấy yêu cầu điểm danh bù');
        }

        if (request.status !== MakeupRequestStatusLocal.pending) {
            throw new BadRequestException('Yêu cầu này đã được xử lý trước đó');
        }

        const status =
            dto.status === 'approved'
                ? MakeupRequestStatusLocal.approved
                : MakeupRequestStatusLocal.rejected;

        // Update the request status
        const updatedRequest = await this.makeupRequestRepository.review(
            requestId,
            reviewerId,
            status as any,
            dto.reviewNote,
        );

        // If approved, update attendance status to 'excused'
        if (status === MakeupRequestStatusLocal.approved) {
            await this.attendanceRepository.upsert({
                sessionId: request.sessionId,
                studentId: request.studentId,
                status: AttendanceStatus.EXCUSED,
                notes: `Điểm danh bù được duyệt: ${dto.reviewNote || request.reason}`,
            });
        }

        return updatedRequest;
    }

    /**
     * Cancel a pending request (by student)
     */
    async cancelRequest(requestId: string, studentId: string) {
        const request = await this.makeupRequestRepository.findById(requestId);

        if (!request) {
            throw new NotFoundException('Không tìm thấy yêu cầu điểm danh bù');
        }

        if (request.studentId !== studentId) {
            throw new ForbiddenException(
                'Bạn không có quyền hủy yêu cầu này',
            );
        }

        if (request.status !== MakeupRequestStatusLocal.pending) {
            throw new BadRequestException('Chỉ có thể hủy yêu cầu đang chờ duyệt');
        }

        return this.makeupRequestRepository.delete(requestId);
    }
}
