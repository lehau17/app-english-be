import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { MakeupRequestRepository } from '../repository/makeup-request.repository';
import { AttendanceRepository, AttendanceStatus } from '../repository/attendance.repository';
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
    constructor(
        private readonly makeupRequestRepository: MakeupRequestRepository,
        private readonly attendanceRepository: AttendanceRepository,
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
        return this.makeupRequestRepository.create({
            sessionId,
            studentId,
            reason: dto.reason,
            evidenceUrls: dto.evidenceUrls,
        });
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
