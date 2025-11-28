import { HashUtil } from '@app/shared';
import {
  ATTENDANCE_CACHE,
  CACHE_TTL,
  RedisCacheService,
} from '@app/shared/redis';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SessionAttendance } from '@prisma/client';
import {
  AttendanceRepository,
  AttendanceStatus,
  AttendanceWithStudent,
  BulkAttendanceInput,
  MarkAttendanceInput,
  SessionAttendanceSummary,
  StudentHistoryFilter,
} from '../repository/attendance.repository';

/**
 * DTO for marking attendance
 */
export interface MarkAttendanceDto {
  status: AttendanceStatus;
  checkInTime?: Date;
  checkOutTime?: Date;
  notes?: string;
}

/**
 * DTO for bulk attendance
 */
export interface BulkAttendanceDto {
  attendances: Array<{
    studentId: string;
    status: AttendanceStatus;
    checkInTime?: Date;
    checkOutTime?: Date;
    notes?: string;
  }>;
}

/**
 * Attendance Service
 *
 * Business logic layer for attendance management.
 * Features:
 * - Version-based caching with Redis
 * - Clean separation from repository layer
 * - Automatic cache invalidation on mutations
 */
@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly cacheService: RedisCacheService,
  ) {}

  // ==================== READ OPERATIONS (with caching) ====================

  /**
   * Get all attendances for a session
   */
  async getSessionAttendances(
    sessionId: string,
  ): Promise<AttendanceWithStudent[]> {
    return this.cacheService.getOrSet(
      ATTENDANCE_CACHE.SESSION_ATTENDANCE,
      sessionId,
      () => this.attendanceRepository.findBySession(sessionId),
      CACHE_TTL.SHORT,
    );
  }

  /**
   * Get attendance summary for a session
   */
  async getSessionSummary(sessionId: string): Promise<SessionAttendanceSummary> {
    return this.cacheService.getOrSet(
      ATTENDANCE_CACHE.SESSION_SUMMARY,
      sessionId,
      () => this.attendanceRepository.getSessionSummary(sessionId),
      CACHE_TTL.SHORT,
    );
  }

  /**
   * Get student attendance history for a classroom with pagination
   */
  async getStudentHistory(
    studentId: string,
    classroomId: string,
    filter: StudentHistoryFilter = {},
  ) {
    // Build cache key using hash of filter
    const filterHash = HashUtil.hashObjectShort({
      studentId,
      classroomId,
      ...filter,
    });

    return this.cacheService.getOrSet(
      ATTENDANCE_CACHE.STUDENT_HISTORY,
      filterHash,
      () =>
        this.attendanceRepository.getStudentAttendanceHistory(
          studentId,
          classroomId,
          filter,
        ),
      CACHE_TTL.MEDIUM,
    );
  }

  /**
   * Get classroom attendance statistics
   */
  async getClassroomStats(classroomId: string) {
    return this.cacheService.getOrSet(
      ATTENDANCE_CACHE.CLASSROOM_STATS,
      classroomId,
      () => this.attendanceRepository.getClassroomStats(classroomId),
      CACHE_TTL.LONG,
    );
  }

  /**
   * Get students not yet marked for a session
   */
  async getUnmarkedStudents(sessionId: string) {
    // No cache for this - always fresh data
    return this.attendanceRepository.getUnmarkedStudents(sessionId);
  }

  // ==================== WRITE OPERATIONS (with cache invalidation) ====================

  /**
   * Mark attendance for a single student
   */
  async markAttendance(
    sessionId: string,
    studentId: string,
    dto: MarkAttendanceDto,
  ): Promise<SessionAttendance> {
    // Validate status
    if (!Object.values(AttendanceStatus).includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${Object.values(AttendanceStatus).join(', ')}`,
      );
    }

    const input: MarkAttendanceInput = {
      sessionId,
      studentId,
      status: dto.status,
      checkInTime: dto.checkInTime,
      checkOutTime: dto.checkOutTime,
      notes: dto.notes,
    };

    const result = await this.attendanceRepository.upsert(input);

    // Invalidate related caches
    await this.invalidateSessionCache(sessionId);

    this.logger.log(
      `Attendance marked: session=${sessionId}, student=${studentId}, status=${dto.status}`,
    );

    return result;
  }

  /**
   * Bulk mark attendance for multiple students
   */
  async bulkMarkAttendance(
    sessionId: string,
    dto: BulkAttendanceDto,
  ): Promise<SessionAttendance[]> {
    // Validate all statuses
    for (const attendance of dto.attendances) {
      if (!Object.values(AttendanceStatus).includes(attendance.status)) {
        throw new BadRequestException(
          `Invalid status for student ${attendance.studentId}. Must be one of: ${Object.values(AttendanceStatus).join(', ')}`,
        );
      }
    }

    const input: BulkAttendanceInput = {
      sessionId,
      attendances: dto.attendances,
    };

    const results = await this.attendanceRepository.bulkUpsert(input);

    // Invalidate related caches
    await this.invalidateSessionCache(sessionId);

    this.logger.log(
      `Bulk attendance marked: session=${sessionId}, count=${results.length}`,
    );

    return results;
  }

  /**
   * Delete attendance record
   */
  async deleteAttendance(
    sessionId: string,
    studentId: string,
  ): Promise<{ success: boolean; message: string }> {
    const deleted = await this.attendanceRepository.deleteBySessionAndStudent(
      sessionId,
      studentId,
    );

    if (!deleted) {
      throw new NotFoundException(
        `Attendance not found for session ${sessionId} and student ${studentId}`,
      );
    }

    // Invalidate related caches
    await this.invalidateSessionCache(sessionId);

    this.logger.log(
      `Attendance deleted: session=${sessionId}, student=${studentId}`,
    );

    return {
      success: true,
      message: 'Attendance deleted successfully',
    };
  }

  /**
   * Quick check-in: Mark student as present with current time
   */
  async quickCheckIn(
    sessionId: string,
    studentId: string,
  ): Promise<SessionAttendance> {
    return this.markAttendance(sessionId, studentId, {
      status: AttendanceStatus.PRESENT,
      checkInTime: new Date(),
    });
  }

  /**
   * Quick check-out: Update check-out time
   */
  async quickCheckOut(
    sessionId: string,
    studentId: string,
  ): Promise<SessionAttendance> {
    const existing = await this.attendanceRepository.findBySessionAndStudent(
      sessionId,
      studentId,
    );

    if (!existing) {
      throw new NotFoundException(
        `No attendance record found for session ${sessionId} and student ${studentId}`,
      );
    }

    const result = await this.attendanceRepository.update(existing.id, {
      checkOutTime: new Date(),
    });

    // Invalidate cache
    await this.invalidateSessionCache(sessionId);

    return result;
  }

  /**
   * Mark all unmarked students as absent
   */
  async markAllAbsent(sessionId: string): Promise<{
    markedCount: number;
    students: Array<{ id: string; name: string }>;
  }> {
    const unmarkedStudents =
      await this.attendanceRepository.getUnmarkedStudents(sessionId);

    if (unmarkedStudents.length === 0) {
      return { markedCount: 0, students: [] };
    }

    const bulkInput: BulkAttendanceInput = {
      sessionId,
      attendances: unmarkedStudents.map((student) => ({
        studentId: student.id,
        status: AttendanceStatus.ABSENT,
      })),
    };

    await this.attendanceRepository.bulkUpsert(bulkInput);

    // Invalidate cache
    await this.invalidateSessionCache(sessionId);

    this.logger.log(
      `Marked ${unmarkedStudents.length} students as absent for session ${sessionId}`,
    );

    return {
      markedCount: unmarkedStudents.length,
      students: unmarkedStudents.map((s) => ({
        id: s.id,
        name: s.displayName || `${s.firstName} ${s.lastName}`,
      })),
    };
  }

  // ==================== CACHE MANAGEMENT ====================

  /**
   * Invalidate all session-related caches
   */
  private async invalidateSessionCache(sessionId: string): Promise<void> {
    // Increment versions for all related cache prefixes
    // This will automatically invalidate old cache entries
    await Promise.all([
      this.cacheService.incrementVersion(ATTENDANCE_CACHE.SESSION_ATTENDANCE),
      this.cacheService.incrementVersion(ATTENDANCE_CACHE.SESSION_SUMMARY),
      this.cacheService.incrementVersion(ATTENDANCE_CACHE.STUDENT_HISTORY),
      this.cacheService.incrementVersion(ATTENDANCE_CACHE.CLASSROOM_STATS),
    ]);

    this.logger.debug(`Cache invalidated for session: ${sessionId}`);
  }

  /**
   * Invalidate all attendance caches (for admin use)
   */
  async invalidateAllCaches(): Promise<void> {
    await Promise.all(
      Object.values(ATTENDANCE_CACHE).map((prefix) =>
        this.cacheService.incrementVersion(prefix),
      ),
    );
    this.logger.log('All attendance caches invalidated');
  }
}
