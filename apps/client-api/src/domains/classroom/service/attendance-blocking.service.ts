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
        pastSessionsCount: 0,
      };
    }

    // Calculate current total absences with percentage
    const { totalSessions, absentCount, absentPercentage, pastSessionsCount } =
      await this.calculateTotalAbsences(classroomId, studentId);

    // Get threshold (returns percentage like 0.30)
    const threshold = getBlockingThreshold(classroom.settings as any);

    // Check if should be blocked (if not already manually blocked)
    const shouldBlock = this.shouldBlock(absentPercentage, threshold);

    // If should be blocked but not currently blocked, auto-block
    if (shouldBlock && !studentRecord.isBlocked) {
      const percentageDisplay = Math.round(absentPercentage * 100);
      const thresholdDisplay = Math.round(threshold * 100);

      await this.autoBlock(
        classroomId,
        studentId,
        `Vắng ${absentCount}/${totalSessions} buổi (${percentageDisplay}%) - vượt ngưỡng ${thresholdDisplay}%`,
      );
      return {
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: `Vắng ${absentCount}/${totalSessions} buổi (${percentageDisplay}%)`,
        consecutiveAbsences: absentCount, // Keep field name for backward compat
        threshold: thresholdDisplay, // Return as percentage number (30 = 30%)
        pastSessionsCount, // Number of past sessions used in calculation
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
        consecutiveAbsences: absentCount,
        threshold: Math.round(threshold * 100),
        pastSessionsCount,
      };
    }

    // Return current status
    return {
      isBlocked: studentRecord.isBlocked,
      blockedAt: studentRecord.blockedAt || undefined,
      blockedReason: studentRecord.blockedReason || undefined,
      consecutiveAbsences: absentCount,
      threshold: Math.round(threshold * 100),
      pastSessionsCount,
      lastAbsenceDate: studentRecord.lastAbsenceDate || undefined,
    };
  }

  /**
   * Calculate total absences for a student in a classroom
   * Only counts past sessions (startTime <= NOW)
   * Excludes excused absences and sessions with approved makeup requests
   * Returns: { totalSessions, absentCount, absentPercentage, pastSessionsCount }
   */
  async calculateTotalAbsences(
    classroomId: string,
    studentId: string,
  ): Promise<{
    totalSessions: number;
    absentCount: number;
    absentPercentage: number;
    pastSessionsCount: number;
  }> {
    const now = new Date();

    // Get ALL sessions (past + future) for denominator
    const allSessions = await this.prisma.classroomSession.findMany({
      where: { classroomId },
      select: {
        id: true,
        startTime: true,
      },
    });

    const totalSessions = allSessions.length;
    if (totalSessions === 0) {
      return {
        totalSessions: 0,
        absentCount: 0,
        absentPercentage: 0,
        pastSessionsCount: 0,
      };
    }

    // Get only PAST sessions for attendance counting (startTime <= NOW)
    const pastSessions = allSessions.filter((s) => s.startTime <= now);
    const pastSessionIds = pastSessions.map((s) => s.id);

    if (pastSessionIds.length === 0) {
      return {
        totalSessions,
        absentCount: 0,
        absentPercentage: 0,
        pastSessionsCount: 0,
      };
    }

    // Get attendance records for past sessions
    const attendances = await this.prisma.sessionAttendance.findMany({
      where: {
        sessionId: { in: pastSessionIds },
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
        sessionId: { in: pastSessionIds },
      },
      select: {
        sessionId: true,
      },
    });

    const makeupSessionIds = new Set(approvedMakeups.map((m) => m.sessionId));
    const attendanceMap = new Map(
      attendances.map((a) => [a.sessionId, a.status]),
    );

    // Count absences (no attendance record OR status = ABSENT)
    // Excluding: excused absences and approved makeups
    let absentCount = 0;
    let lastAbsenceDate: Date | null = null;

    for (const sessionId of pastSessionIds) {
      // Skip if approved makeup exists
      if (makeupSessionIds.has(sessionId)) {
        continue;
      }

      const status = attendanceMap.get(sessionId);

      // Count as absent if: no record OR status = ABSENT
      // Don't count if: status = EXCUSED
      if (!status || status === AttendanceStatus.ABSENT) {
        absentCount++;
        const session = pastSessions.find((s) => s.id === sessionId);
        if (
          session &&
          (!lastAbsenceDate || session.startTime > lastAbsenceDate)
        ) {
          lastAbsenceDate = session.startTime;
        }
      }
    }

    // Calculate percentage based on past sessions only (matches absentCount scope)
    const absentPercentage =
      pastSessions.length > 0 ? absentCount / pastSessions.length : 0;

    // Update cached values in ClassroomStudent
    await this.prisma.classroomStudent.update({
      where: {
        classroomId_studentId: { classroomId, studentId },
      },
      data: {
        consecutiveAbsences: absentCount, // Reuse field for total absences
        lastAbsenceDate: lastAbsenceDate,
      },
    });

    return {
      totalSessions,
      absentCount,
      absentPercentage,
      pastSessionsCount: pastSessions.length,
    };
  }

  /**
   * Determine if student should be blocked based on absence percentage
   * @param absentPercentage - Percentage of total absences (0.0 to 1.0)
   * @param threshold - Threshold percentage (e.g., 0.30 for 30%)
   */
  shouldBlock(absentPercentage: number, threshold: number): boolean {
    return absentPercentage >= threshold;
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
