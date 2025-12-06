import { PrismaRepository } from '@app/database';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, SessionAttendance } from '@prisma/client';

/**
 * Attendance status enum
 */
export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused',
}

/**
 * Mark attendance input
 */
export interface MarkAttendanceInput {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  checkInTime?: Date;
  checkOutTime?: Date;
  notes?: string;
}

/**
 * Bulk mark attendance input
 */
export interface BulkAttendanceInput {
  sessionId: string;
  attendances: Array<{
    studentId: string;
    status: AttendanceStatus;
    checkInTime?: Date;
    checkOutTime?: Date;
    notes?: string;
  }>;
}

/**
 * Filter for student attendance history
 */
export interface StudentHistoryFilter {
  page?: number;
  limit?: number;
  fromDate?: Date;
  toDate?: Date;
  status?: AttendanceStatus;
}

/**
 * Attendance with relations
 */
export interface AttendanceWithStudent extends SessionAttendance {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

/**
 * Session attendance summary
 */
export interface SessionAttendanceSummary {
  sessionId: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
  attendances: AttendanceWithStudent[];
}

/**
 * Attendance Repository
 *
 * Handles all database operations for session attendance.
 * Following Repository Pattern for clean separation of concerns.
 */
@Injectable()
export class AttendanceRepository {
  private readonly logger = new Logger(AttendanceRepository.name);

  constructor(private readonly prisma: PrismaRepository) {}

  // ==================== BASIC CRUD ====================

  /**
   * Find attendance by ID
   */
  async findById(id: string): Promise<SessionAttendance | null> {
    return this.prisma.sessionAttendance.findUnique({
      where: { id },
    });
  }

  /**
   * Find attendance by session and student
   */
  async findBySessionAndStudent(
    sessionId: string,
    studentId: string,
  ): Promise<SessionAttendance | null> {
    return this.prisma.sessionAttendance.findUnique({
      where: {
        sessionId_studentId: { sessionId, studentId },
      },
    });
  }

  /**
   * Create attendance record
   */
  async create(
    data: Prisma.SessionAttendanceUncheckedCreateInput,
  ): Promise<SessionAttendance> {
    return this.prisma.sessionAttendance.create({
      data,
    });
  }

  /**
   * Update attendance record
   */
  async update(
    id: string,
    data: Prisma.SessionAttendanceUpdateInput,
  ): Promise<SessionAttendance> {
    return this.prisma.sessionAttendance.update({
      where: { id },
      data,
    });
  }

  /**
   * Upsert attendance (create or update)
   */
  async upsert(input: MarkAttendanceInput): Promise<SessionAttendance> {
    const { sessionId, studentId, status, checkInTime, checkOutTime, notes } =
      input;

    return this.prisma.sessionAttendance.upsert({
      where: {
        sessionId_studentId: { sessionId, studentId },
      },
      create: {
        sessionId,
        studentId,
        status,
        checkInTime,
        checkOutTime,
        notes,
      },
      update: {
        status,
        checkInTime,
        checkOutTime,
        notes,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete attendance record
   */
  async delete(id: string): Promise<SessionAttendance> {
    return this.prisma.sessionAttendance.delete({
      where: { id },
    });
  }

  /**
   * Delete attendance by session and student
   */
  async deleteBySessionAndStudent(
    sessionId: string,
    studentId: string,
  ): Promise<SessionAttendance | null> {
    try {
      return await this.prisma.sessionAttendance.delete({
        where: {
          sessionId_studentId: { sessionId, studentId },
        },
      });
    } catch {
      return null;
    }
  }

  // ==================== QUERY OPERATIONS ====================

  /**
   * Get all attendances for a session with student details
   */
  async findBySession(sessionId: string): Promise<AttendanceWithStudent[]> {
    return this.prisma.sessionAttendance.findMany({
      where: { sessionId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { student: { displayName: 'asc' } },
        { student: { lastName: 'asc' } },
      ],
    });
  }

  /**
   * Get attendance summary for a session
   */
  async getSessionSummary(sessionId: string): Promise<SessionAttendanceSummary> {
    // First try to find by ClassroomSession.id
    let session = await this.prisma.classroomSession.findUnique({
      where: { id: sessionId },
      include: {
        classroom: {
          include: {
            students: {
              where: { isActive: true },
              select: { studentId: true },
            },
          },
        },
      },
    });

    // If not found, try to find by metadata.courseSessionScheduleId
    // (in case frontend passes SessionSchedule.id instead of ClassroomSession.id)
    if (!session) {
      this.logger.warn(
        `ClassroomSession not found by id: ${sessionId}. Trying to find by metadata.courseSessionScheduleId`,
      );

      // Try to find SessionSchedule first to get courseId
      const sessionSchedule = await this.prisma.sessionSchedule.findUnique({
        where: { id: sessionId },
        select: { courseId: true, sessionNumber: true },
      });

      if (sessionSchedule) {
        // Find classroom with this courseId
        const classroom = await this.prisma.classroom.findFirst({
          where: { courseId: sessionSchedule.courseId },
          select: { id: true },
        });

        if (classroom) {
          // Find ClassroomSession by classroomId and metadata
          const sessions = await this.prisma.classroomSession.findMany({
            where: { classroomId: classroom.id },
            include: {
              classroom: {
                include: {
                  students: {
                    where: { isActive: true },
                    select: { studentId: true },
                  },
                },
              },
            },
          });

          // Filter by metadata.courseSessionScheduleId
          session = sessions.find((s) => {
            if (s.metadata && typeof s.metadata === 'object') {
              const metadata = s.metadata as any;
              return metadata.courseSessionScheduleId === sessionId;
            }
            return false;
          }) || null;
        }
      }
    }

    if (!session) {
      this.logger.error(
        `ClassroomSession not found for sessionId: ${sessionId}. This might be a SessionSchedule ID.`,
      );
      throw new NotFoundException(
        `ClassroomSession not found for sessionId: ${sessionId}. ` +
        `If this is a SessionSchedule ID, please ensure the corresponding ClassroomSession exists.`,
      );
    }

    const totalStudents = session.classroom.students.length;

    // Get attendances
    const attendances = await this.findBySession(sessionId);

    // Calculate stats
    const stats = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    attendances.forEach((a) => {
      if (a.status in stats) {
        stats[a.status as keyof typeof stats]++;
      }
    });

    // Calculate attendance rate (present + late counts as attended)
    const attended = stats.present + stats.late;
    const attendanceRate =
      totalStudents > 0 ? Math.round((attended / totalStudents) * 100) : 0;

    return {
      sessionId,
      totalStudents,
      ...stats,
      attendanceRate,
      attendances,
    };
  }

  /**
   * Get student attendance history for a classroom with pagination and filter
   */
  async getStudentAttendanceHistory(
    studentId: string,
    classroomId: string,
    filter: StudentHistoryFilter = {},
  ): Promise<{
    totalSessions: number;
    attended: number;
    absent: number;
    late: number;
    excused: number;
    present: number;
    attendanceRate: number;
    history: Array<{
      sessionId: string;
      sessionTitle: string;
      sessionDate: Date;
      status: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const { page = 1, limit = 20, fromDate, toDate, status } = filter;
    const skip = (page - 1) * limit;

    // Build session filter
    const sessionWhere: any = { classroomId };
    if (fromDate || toDate) {
      sessionWhere.startTime = {};
      if (fromDate) sessionWhere.startTime.gte = fromDate;
      if (toDate) sessionWhere.startTime.lte = toDate;
    }

    // Get total count for stats (all sessions, not paginated)
    const allSessions = await this.prisma.classroomSession.findMany({
      where: sessionWhere,
      select: {
        id: true,
        attendance: {
          where: { studentId },
          select: { status: true },
        },
      },
    });

    // Calculate overall stats
    const stats = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    allSessions.forEach((session) => {
      const attendance = session.attendance[0];
      if (attendance && attendance.status in stats) {
        stats[attendance.status as keyof typeof stats]++;
      }
    });

    const attended = stats.present + stats.late;
    const totalSessions = allSessions.length;
    const attendanceRate =
      totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;

    // Build attendance filter for paginated history
    const attendanceWhere: any = { studentId };
    if (status) {
      attendanceWhere.status = status;
    }

    // Get paginated sessions with attendance
    const sessions = await this.prisma.classroomSession.findMany({
      where: {
        ...sessionWhere,
        attendance: status ? { some: attendanceWhere } : undefined,
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        attendance: {
          where: { studentId },
          select: { status: true },
        },
      },
      orderBy: { startTime: 'desc' },
      skip,
      take: limit,
    });

    // Count total for pagination
    const totalItems = await this.prisma.classroomSession.count({
      where: {
        ...sessionWhere,
        attendance: status ? { some: attendanceWhere } : undefined,
      },
    });

    const history = sessions.map((session) => {
      const attendance = session.attendance[0];
      return {
        sessionId: session.id,
        sessionTitle: session.title || 'Untitled Session',
        sessionDate: session.startTime,
        status: attendance?.status || 'not_marked',
      };
    });

    const totalPages = Math.ceil(totalItems / limit);

    return {
      totalSessions,
      attended,
      ...stats,
      attendanceRate,
      history,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk mark attendance for a session
   * Uses transaction for data integrity
   */
  async bulkUpsert(input: BulkAttendanceInput): Promise<SessionAttendance[]> {
    const { sessionId, attendances } = input;

    return this.prisma.$transaction(async (tx) => {
      const results: SessionAttendance[] = [];

      for (const attendance of attendances) {
        const result = await tx.sessionAttendance.upsert({
          where: {
            sessionId_studentId: {
              sessionId,
              studentId: attendance.studentId,
            },
          },
          create: {
            sessionId,
            studentId: attendance.studentId,
            status: attendance.status,
            checkInTime: attendance.checkInTime,
            checkOutTime: attendance.checkOutTime,
            notes: attendance.notes,
          },
          update: {
            status: attendance.status,
            checkInTime: attendance.checkInTime,
            checkOutTime: attendance.checkOutTime,
            notes: attendance.notes,
            updatedAt: new Date(),
          },
        });
        results.push(result);
      }

      return results;
    });
  }

  /**
   * Get students without attendance for a session
   * (Students in classroom but not marked yet)
   */
  async getUnmarkedStudents(sessionId: string): Promise<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      displayName: string;
      avatarUrl: string | null;
    }>
  > {
    const session = await this.prisma.classroomSession.findUnique({
      where: { id: sessionId },
      select: { classroomId: true },
    });

    if (!session) {
      return [];
    }

    // Get all students in classroom
    const classroomStudents = await this.prisma.classroomStudent.findMany({
      where: {
        classroomId: session.classroomId,
        isActive: true,
      },
      select: { studentId: true },
    });

    // Get students already marked
    const markedStudentIds = await this.prisma.sessionAttendance.findMany({
      where: { sessionId },
      select: { studentId: true },
    });

    const markedIds = new Set(markedStudentIds.map((m) => m.studentId));

    // Filter unmarked students
    const unmarkedIds = classroomStudents
      .filter((cs) => !markedIds.has(cs.studentId))
      .map((cs) => cs.studentId);

    if (unmarkedIds.length === 0) {
      return [];
    }

    // Get student details
    return this.prisma.user.findMany({
      where: {
        id: { in: unmarkedIds },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
      },
    });
  }

  // ==================== STATISTICS ====================

  /**
   * Get classroom attendance statistics
   */
  async getClassroomStats(classroomId: string): Promise<{
    totalSessions: number;
    averageAttendanceRate: number;
    studentStats: Array<{
      studentId: string;
      studentName: string;
      attendanceRate: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
    }>;
  }> {
    // Get all sessions
    const sessions = await this.prisma.classroomSession.findMany({
      where: { classroomId },
      select: {
        id: true,
        attendance: {
          select: {
            studentId: true,
            status: true,
          },
        },
      },
    });

    // Get classroom students
    const students = await this.prisma.classroomStudent.findMany({
      where: { classroomId, isActive: true },
      include: {
        student: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    const totalSessions = sessions.length;
    const studentStatsMap = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        present: number;
        absent: number;
        late: number;
        excused: number;
      }
    >();

    // Initialize stats for all students
    students.forEach((s) => {
      studentStatsMap.set(s.studentId, {
        studentId: s.studentId,
        studentName: s.student.displayName || 'Unknown',
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      });
    });

    // Aggregate attendance
    sessions.forEach((session) => {
      session.attendance.forEach((a) => {
        const stats = studentStatsMap.get(a.studentId);
        if (stats && a.status in stats) {
          stats[a.status as 'present' | 'absent' | 'late' | 'excused']++;
        }
      });
    });

    // Calculate rates
    const studentStats = Array.from(studentStatsMap.values()).map((stats) => {
      const attended = stats.present + stats.late;
      const attendanceRate =
        totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
      return { ...stats, attendanceRate };
    });

    // Calculate average
    const averageAttendanceRate =
      studentStats.length > 0
        ? Math.round(
            studentStats.reduce((sum, s) => sum + s.attendanceRate, 0) /
              studentStats.length,
          )
        : 0;

    return {
      totalSessions,
      averageAttendanceRate,
      studentStats: studentStats.sort((a, b) => b.attendanceRate - a.attendanceRate),
    };
  }
}
