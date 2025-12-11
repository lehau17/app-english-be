import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { getBlockingThreshold } from '../../../config/attendance-blocking.config';
import { BlockingStatusDto } from '../dto/attendance-blocking.dto';
import { AttendanceStatus } from '../repository/attendance.repository';

/**
 * Attendance Blocking Service
 * Handles logic for blocking students based on consecutive absences
 */
@Injectable()
export class AttendanceBlockingService {
  private readonly logger = new Logger(AttendanceBlockingService.name);

  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Check if student should be blocked and return blocking status
   */
  async checkBlockingStatus(
    classroomId: string,
    studentId: string,
  ): Promise<BlockingStatusDto> {
    // Get classroom settings
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      select: {
        id: true,
        settings: true,
      },
    });

    if (!classroom) {
      throw new Error(`Classroom ${classroomId} not found`);
    }

    // Get student enrollment record
    const studentRecord = await this.prisma.classroomStudent.findUnique({
      where: {
        classroomId_studentId: { classroomId, studentId },
      },
      select: {
        isBlocked: true,
        blockedAt: true,
        blockedReason: true,
        consecutiveAbsences: true,
        lastAbsenceDate: true,
      },
    });

    if (!studentRecord) {
      // Student not enrolled, no blocking
      return {
        isBlocked: false,
        consecutiveAbsences: 0,
        threshold: getBlockingThreshold(classroom.settings as any),
      };
    }

    // Calculate current consecutive absences
    const consecutiveAbsences = await this.calculateConsecutiveAbsences(
      classroomId,
      studentId,
    );

    // Get threshold
    const threshold = getBlockingThreshold(classroom.settings as any);

    // Check if should be blocked (if not already manually blocked)
    const shouldBlock = this.shouldBlock(consecutiveAbsences, threshold);

    // If should be blocked but not currently blocked, auto-block
    if (shouldBlock && !studentRecord.isBlocked) {
      await this.autoBlock(
        classroomId,
        studentId,
        `Vắng ${consecutiveAbsences} buổi liên tiếp (ngưỡng: ${threshold})`,
      );
      return {
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: `Vắng ${consecutiveAbsences} buổi liên tiếp`,
        consecutiveAbsences,
        threshold,
        lastAbsenceDate: studentRecord.lastAbsenceDate || undefined,
      };
    }

    // If should not be blocked but currently blocked (auto-blocked), auto-unblock
    if (
      !shouldBlock &&
      studentRecord.isBlocked &&
      !studentRecord.blockedReason?.includes('Thủ công')
    ) {
      await this.autoUnblock(classroomId, studentId);
      return {
        isBlocked: false,
        consecutiveAbsences,
        threshold,
      };
    }

    // Return current status
    return {
      isBlocked: studentRecord.isBlocked,
      blockedAt: studentRecord.blockedAt || undefined,
      blockedReason: studentRecord.blockedReason || undefined,
      consecutiveAbsences,
      threshold,
      lastAbsenceDate: studentRecord.lastAbsenceDate || undefined,
    };
  }

  /**
   * Calculate consecutive absences for a student in a classroom
   * Excludes excused absences and sessions with approved makeup requests
   */
  async calculateConsecutiveAbsences(
    classroomId: string,
    studentId: string,
  ): Promise<number> {
    // Get all sessions for this classroom, ordered by startTime DESC (most recent first)
    const sessions = await this.prisma.classroomSession.findMany({
      where: { classroomId },
      select: {
        id: true,
        startTime: true,
      },
      orderBy: { startTime: 'desc' },
    });

    if (sessions.length === 0) {
      return 0;
    }

    // Get all attendance records for this student
    const attendances = await this.prisma.sessionAttendance.findMany({
      where: {
        sessionId: { in: sessions.map((s) => s.id) },
        studentId,
      },
      select: {
        sessionId: true,
        status: true,
      },
    });

    // Get approved makeup requests (these count as present)
    const approvedMakeups = await this.prisma.makeupAttendanceRequest.findMany({
      where: {
        studentId,
        status: 'approved',
        session: {
          classroomId,
        },
      },
      select: {
        sessionId: true,
      },
    });

    const makeupSessionIds = new Set(approvedMakeups.map((m) => m.sessionId));

    // Create map of sessionId -> attendance status
    const attendanceMap = new Map<string, string>();
    attendances.forEach((att) => {
      attendanceMap.set(att.sessionId, att.status);
    });

    // Count consecutive absences from most recent session backwards
    let consecutiveCount = 0;
    for (const session of sessions) {
      const attendance = attendanceMap.get(session.id);

      // If no attendance record, count as absent (unless makeup approved)
      if (!attendance) {
        if (makeupSessionIds.has(session.id)) {
          // Approved makeup = present, break streak
          break;
        }
        consecutiveCount++;
        continue;
      }

      // Check status
      if (attendance === AttendanceStatus.ABSENT) {
        consecutiveCount++;
      } else if (
        attendance === AttendanceStatus.PRESENT ||
        attendance === AttendanceStatus.LATE
      ) {
        // Present or late = break streak
        break;
      } else if (attendance === AttendanceStatus.EXCUSED) {
        // Excused = don't count, but also don't break streak
        // Continue to next session
        continue;
      }
    }

    // Update cached count in ClassroomStudent
    await this.prisma.classroomStudent.update({
      where: {
        classroomId_studentId: { classroomId, studentId },
      },
      data: {
        consecutiveAbsences: consecutiveCount,
        lastAbsenceDate:
          consecutiveCount > 0
            ? sessions.find((s) => {
                const att = attendanceMap.get(s.id);
                return !att || att === AttendanceStatus.ABSENT;
              })?.startTime || null
            : null,
      },
    });

    return consecutiveCount;
  }

  /**
   * Determine if student should be blocked based on consecutive absences
   */
  shouldBlock(consecutiveAbsences: number, threshold: number): boolean {
    return consecutiveAbsences >= threshold;
  }

  /**
   * Auto-block student when threshold reached
   */
  async autoBlock(
    classroomId: string,
    studentId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.classroomStudent.update({
      where: {
        classroomId_studentId: { classroomId, studentId },
      },
      data: {
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: reason,
      },
    });

    this.logger.warn(
      `Auto-blocked student ${studentId} in classroom ${classroomId}: ${reason}`,
    );
  }

  /**
   * Auto-unblock student when attendance improves
   */
  async autoUnblock(classroomId: string, studentId: string): Promise<void> {
    await this.prisma.classroomStudent.update({
      where: {
        classroomId_studentId: { classroomId, studentId },
      },
      data: {
        isBlocked: false,
        blockedAt: null,
        blockedReason: null,
      },
    });

    this.logger.log(
      `Auto-unblocked student ${studentId} in classroom ${classroomId}`,
    );
  }

  /**
   * Manually block student (admin/teacher action)
   */
  async manualBlock(
    classroomId: string,
    studentId: string,
    reason: string,
    blockedBy: string,
  ): Promise<void> {
    await this.prisma.classroomStudent.update({
      where: {
        classroomId_studentId: { classroomId, studentId },
      },
      data: {
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: `Thủ công: ${reason} (bởi ${blockedBy})`,
      },
    });

    this.logger.warn(
      `Manually blocked student ${studentId} in classroom ${classroomId} by ${blockedBy}: ${reason}`,
    );
  }

  /**
   * Manually unblock student (admin/teacher action)
   */
  async manualUnblock(
    classroomId: string,
    studentId: string,
    reason: string,
    unblockedBy: string,
  ): Promise<void> {
    await this.prisma.classroomStudent.update({
      where: {
        classroomId_studentId: { classroomId, studentId },
      },
      data: {
        isBlocked: false,
        blockedAt: null,
        blockedReason: null,
        consecutiveAbsences: 0, // Reset count
      },
    });

    this.logger.log(
      `Manually unblocked student ${studentId} in classroom ${classroomId} by ${unblockedBy}: ${reason}`,
    );
  }

  /**
   * Get list of blocked students in a classroom
   */
  async getBlockedStudents(classroomId: string) {
    return this.prisma.classroomStudent.findMany({
      where: {
        classroomId,
        isActive: true,
        isBlocked: true,
      },
      include: {
        student: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        blockedAt: 'desc',
      },
    });
  }
}
