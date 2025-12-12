import { AttendanceBlockingService } from './attendance-blocking.service';
import { PrismaRepository } from '@app/database';
import { AttendanceStatus } from '../repository/attendance.repository';
import { Logger } from '@nestjs/common';

describe('AttendanceBlockingService', () => {
  let service: AttendanceBlockingService;
  let prisma: jest.Mocked<PrismaRepository>;

  beforeEach(() => {
    // Create mock Prisma repository
    prisma = {
      classroomSession: {
        findMany: jest.fn(),
      },
      sessionAttendance: {
        findMany: jest.fn(),
      },
      makeupAttendanceRequest: {
        findMany: jest.fn(),
      },
      classroomStudent: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      classroom: {
        findUnique: jest.fn(),
      },
    } as any;

    // Create service with mocked Prisma
    service = new AttendanceBlockingService(prisma);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('calculateTotalAbsences - basic calculation', () => {
    const classroomId = 'classroom-1';
    const studentId = 'student-1';

    it('should calculate 100% when student missed all past sessions', async () => {
      // Arrange: 2 total sessions, 1 past session, 1 absent
      const now = new Date('2025-12-12T12:00:00Z');
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') }, // past
        { id: 's2', startTime: new Date('2025-12-20T10:00:00Z') }, // future
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue([]); // no attendance = absent
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      // Act
      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      // Assert
      expect(result.totalSessions).toBe(2);
      expect(result.absentCount).toBe(1); // only 1 past session, counted as absent
      expect(result.absentPercentage).toBe(1.0); // 1/1 = 100%
    });

    it('should calculate 33.33% when student missed 1 of 3 past sessions', async () => {
      // Arrange: 8 total, 3 past, 1 absent
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') }, // past
        { id: 's2', startTime: new Date('2025-12-02T10:00:00Z') }, // past
        { id: 's3', startTime: new Date('2025-12-03T10:00:00Z') }, // past
        { id: 's4', startTime: new Date('2025-12-20T10:00:00Z') }, // future
        { id: 's5', startTime: new Date('2025-12-21T10:00:00Z') }, // future
        { id: 's6', startTime: new Date('2025-12-22T10:00:00Z') }, // future
        { id: 's7', startTime: new Date('2025-12-23T10:00:00Z') }, // future
        { id: 's8', startTime: new Date('2025-12-24T10:00:00Z') }, // future
      ];

      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.PRESENT },
        { sessionId: 's2', status: AttendanceStatus.PRESENT },
        // s3 has no attendance record = absent
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      // Act
      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      // Assert
      expect(result.totalSessions).toBe(8);
      expect(result.absentCount).toBe(1);
      expect(result.absentPercentage).toBeCloseTo(0.333, 2); // 1/3 = 33.33%
    });

    it('should calculate 50% when student missed 2 of 4 past sessions', async () => {
      // Arrange: 4 past sessions, 2 absent
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') }, // past
        { id: 's2', startTime: new Date('2025-12-02T10:00:00Z') }, // past
        { id: 's3', startTime: new Date('2025-12-03T10:00:00Z') }, // past
        { id: 's4', startTime: new Date('2025-12-04T10:00:00Z') }, // past
      ];

      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.PRESENT },
        { sessionId: 's2', status: AttendanceStatus.ABSENT },
        { sessionId: 's3', status: AttendanceStatus.PRESENT },
        { sessionId: 's4', status: AttendanceStatus.ABSENT },
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      // Act
      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      // Assert
      expect(result.totalSessions).toBe(4);
      expect(result.absentCount).toBe(2);
      expect(result.absentPercentage).toBe(0.5); // 2/4 = 50%
    });

    it('should calculate 0% when student attended all past sessions', async () => {
      // Arrange: 8 total, 3 past, 0 absent
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') }, // past
        { id: 's2', startTime: new Date('2025-12-02T10:00:00Z') }, // past
        { id: 's3', startTime: new Date('2025-12-03T10:00:00Z') }, // past
        { id: 's4', startTime: new Date('2025-12-20T10:00:00Z') }, // future
        { id: 's5', startTime: new Date('2025-12-21T10:00:00Z') }, // future
      ];

      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.PRESENT },
        { sessionId: 's2', status: AttendanceStatus.PRESENT },
        { sessionId: 's3', status: AttendanceStatus.PRESENT },
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      // Act
      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      // Assert
      expect(result.totalSessions).toBe(5);
      expect(result.absentCount).toBe(0);
      expect(result.absentPercentage).toBe(0); // 0/3 = 0%
    });

    it('should ignore future sessions in calculation', async () => {
      // Arrange: 8 total, 2 past (6 future), 1 absent
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') }, // past
        { id: 's2', startTime: new Date('2025-12-02T10:00:00Z') }, // past
        { id: 's3', startTime: new Date('2025-12-20T10:00:00Z') }, // future
        { id: 's4', startTime: new Date('2025-12-21T10:00:00Z') }, // future
        { id: 's5', startTime: new Date('2025-12-22T10:00:00Z') }, // future
        { id: 's6', startTime: new Date('2025-12-23T10:00:00Z') }, // future
        { id: 's7', startTime: new Date('2025-12-24T10:00:00Z') }, // future
        { id: 's8', startTime: new Date('2025-12-25T10:00:00Z') }, // future
      ];

      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.PRESENT },
        // s2 has no attendance = absent
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      // Act
      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      // Assert
      expect(result.totalSessions).toBe(8);
      expect(result.absentCount).toBe(1);
      expect(result.absentPercentage).toBe(0.5); // 1/2 = 50% (NOT 1/8 = 12.5%)
    });
  });

  describe('calculateTotalAbsences - edge cases', () => {
    const classroomId = 'classroom-1';
    const studentId = 'student-1';

    it('should return 0% when no past sessions exist (all future)', async () => {
      // Arrange: 8 total, 0 past (all future)
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-20T10:00:00Z') }, // future
        { id: 's2', startTime: new Date('2025-12-21T10:00:00Z') }, // future
        { id: 's3', startTime: new Date('2025-12-22T10:00:00Z') }, // future
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue([]);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      // Act
      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      // Assert
      expect(result.totalSessions).toBe(3);
      expect(result.absentCount).toBe(0);
      expect(result.absentPercentage).toBe(0); // Not NaN or undefined
    });

    it('should return 0% when no sessions exist at all', async () => {
      // Arrange: 0 total sessions
      prisma.classroomSession.findMany.mockResolvedValue([]);
      prisma.sessionAttendance.findMany.mockResolvedValue([]);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);

      // Act
      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      // Assert
      expect(result.totalSessions).toBe(0);
      expect(result.absentCount).toBe(0);
      expect(result.absentPercentage).toBe(0); // Zero-division protection
    });

    it('should count missing attendance records as absent', async () => {
      // Arrange: 3 past sessions, no attendance records created
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') }, // past
        { id: 's2', startTime: new Date('2025-12-02T10:00:00Z') }, // past
        { id: 's3', startTime: new Date('2025-12-03T10:00:00Z') }, // past
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue([]); // No records
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      // Act
      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      // Assert
      expect(result.totalSessions).toBe(3);
      expect(result.absentCount).toBe(3); // All 3 counted as absent
      expect(result.absentPercentage).toBe(1.0); // 3/3 = 100%
    });

    it('should handle all sessions being past', async () => {
      // Arrange: 8 total, 8 past, 2 absent
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') },
        { id: 's2', startTime: new Date('2025-12-02T10:00:00Z') },
        { id: 's3', startTime: new Date('2025-12-03T10:00:00Z') },
        { id: 's4', startTime: new Date('2025-12-04T10:00:00Z') },
        { id: 's5', startTime: new Date('2025-12-05T10:00:00Z') },
        { id: 's6', startTime: new Date('2025-12-06T10:00:00Z') },
        { id: 's7', startTime: new Date('2025-12-07T10:00:00Z') },
        { id: 's8', startTime: new Date('2025-12-08T10:00:00Z') },
      ];

      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.PRESENT },
        { sessionId: 's2', status: AttendanceStatus.ABSENT },
        { sessionId: 's3', status: AttendanceStatus.PRESENT },
        { sessionId: 's4', status: AttendanceStatus.PRESENT },
        { sessionId: 's5', status: AttendanceStatus.PRESENT },
        { sessionId: 's6', status: AttendanceStatus.ABSENT },
        { sessionId: 's7', status: AttendanceStatus.PRESENT },
        { sessionId: 's8', status: AttendanceStatus.PRESENT },
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      // Act
      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      // Assert
      expect(result.totalSessions).toBe(8);
      expect(result.absentCount).toBe(2);
      expect(result.absentPercentage).toBe(0.25); // 2/8 = 25%
    });
  });

  describe('calculateTotalAbsences - attendance status mapping', () => {
    const classroomId = 'classroom-1';
    const studentId = 'student-1';

    const createBaseSessions = () => [
      { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') },
      { id: 's2', startTime: new Date('2025-12-02T10:00:00Z') },
      { id: 's3', startTime: new Date('2025-12-03T10:00:00Z') },
    ];

    it('should count ABSENT status as absent', async () => {
      const sessions = createBaseSessions();
      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.ABSENT },
        { sessionId: 's2', status: AttendanceStatus.PRESENT },
        { sessionId: 's3', status: AttendanceStatus.PRESENT },
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      expect(result.absentCount).toBe(1);
      expect(result.absentPercentage).toBeCloseTo(0.333, 2); // 1/3
    });

    it('should NOT count PRESENT status as absent', async () => {
      const sessions = createBaseSessions();
      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.PRESENT },
        { sessionId: 's2', status: AttendanceStatus.PRESENT },
        { sessionId: 's3', status: AttendanceStatus.PRESENT },
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      expect(result.absentCount).toBe(0);
      expect(result.absentPercentage).toBe(0);
    });

    it('should NOT count LATE status as absent', async () => {
      const sessions = createBaseSessions();
      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.LATE },
        { sessionId: 's2', status: AttendanceStatus.PRESENT },
        { sessionId: 's3', status: AttendanceStatus.PRESENT },
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      expect(result.absentCount).toBe(0);
      expect(result.absentPercentage).toBe(0);
    });

    it('should NOT count EXCUSED status as absent', async () => {
      const sessions = createBaseSessions();
      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.EXCUSED },
        { sessionId: 's2', status: AttendanceStatus.PRESENT },
        { sessionId: 's3', status: AttendanceStatus.PRESENT },
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      expect(result.absentCount).toBe(0);
      expect(result.absentPercentage).toBe(0);
    });

    it('should handle mixed attendance statuses correctly', async () => {
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') },
        { id: 's2', startTime: new Date('2025-12-02T10:00:00Z') },
        { id: 's3', startTime: new Date('2025-12-03T10:00:00Z') },
        { id: 's4', startTime: new Date('2025-12-04T10:00:00Z') },
        { id: 's5', startTime: new Date('2025-12-05T10:00:00Z') },
      ];

      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.PRESENT },
        { sessionId: 's2', status: AttendanceStatus.ABSENT },
        { sessionId: 's3', status: AttendanceStatus.LATE },
        { sessionId: 's4', status: AttendanceStatus.EXCUSED },
        { sessionId: 's5', status: AttendanceStatus.ABSENT },
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      // Only s2 and s5 should be counted as absent
      expect(result.absentCount).toBe(2);
      expect(result.absentPercentage).toBe(0.4); // 2/5 = 40%
    });
  });

  describe('calculateTotalAbsences - approved makeup requests', () => {
    const classroomId = 'classroom-1';
    const studentId = 'student-1';

    it('should exclude sessions with approved makeup requests from absent count', async () => {
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') },
        { id: 's2', startTime: new Date('2025-12-02T10:00:00Z') },
        { id: 's3', startTime: new Date('2025-12-03T10:00:00Z') },
      ];

      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.ABSENT },
        // s2 has no attendance = normally absent, but has approved makeup
        { sessionId: 's3', status: AttendanceStatus.PRESENT },
      ];

      const approvedMakeups = [
        { sessionId: 's2' }, // Approved makeup for s2
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue(
        approvedMakeups as any,
      );
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      const result = await service['calculateTotalAbsences'](
        classroomId,
        studentId,
      );

      // Only s1 should count as absent (s2 has approved makeup)
      expect(result.absentCount).toBe(1);
      expect(result.absentPercentage).toBeCloseTo(0.333, 2); // 1/3
    });
  });

  describe('calculateTotalAbsences - database updates', () => {
    const classroomId = 'classroom-1';
    const studentId = 'student-1';

    it('should update ClassroomStudent.consecutiveAbsences field', async () => {
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') },
        { id: 's2', startTime: new Date('2025-12-02T10:00:00Z') },
      ];

      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.ABSENT },
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      await service['calculateTotalAbsences'](classroomId, studentId);

      expect(prisma.classroomStudent.update).toHaveBeenCalledWith({
        where: {
          classroomId_studentId: { classroomId, studentId },
        },
        data: {
          consecutiveAbsences: 1,
          lastAbsenceDate: sessions[0].startTime,
        },
      });
    });

    it('should update lastAbsenceDate to most recent absence', async () => {
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') },
        { id: 's2', startTime: new Date('2025-12-02T10:00:00Z') },
        { id: 's3', startTime: new Date('2025-12-03T10:00:00Z') },
      ];

      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.ABSENT },
        { sessionId: 's2', status: AttendanceStatus.PRESENT },
        { sessionId: 's3', status: AttendanceStatus.ABSENT },
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      await service['calculateTotalAbsences'](classroomId, studentId);

      expect(prisma.classroomStudent.update).toHaveBeenCalledWith({
        where: {
          classroomId_studentId: { classroomId, studentId },
        },
        data: {
          consecutiveAbsences: 2,
          lastAbsenceDate: sessions[2].startTime, // Most recent = s3
        },
      });
    });

    it('should set lastAbsenceDate to null when no absences', async () => {
      const sessions = [
        { id: 's1', startTime: new Date('2025-12-01T10:00:00Z') },
        { id: 's2', startTime: new Date('2025-12-02T10:00:00Z') },
      ];

      const attendances = [
        { sessionId: 's1', status: AttendanceStatus.PRESENT },
        { sessionId: 's2', status: AttendanceStatus.PRESENT },
      ];

      prisma.classroomSession.findMany.mockResolvedValue(sessions as any);
      prisma.sessionAttendance.findMany.mockResolvedValue(attendances as any);
      prisma.makeupAttendanceRequest.findMany.mockResolvedValue([]);
      prisma.classroomStudent.update.mockResolvedValue({} as any);

      await service['calculateTotalAbsences'](classroomId, studentId);

      expect(prisma.classroomStudent.update).toHaveBeenCalledWith({
        where: {
          classroomId_studentId: { classroomId, studentId },
        },
        data: {
          consecutiveAbsences: 0,
          lastAbsenceDate: null,
        },
      });
    });
  });

  describe('shouldBlock', () => {
    it('should return true when absentPercentage >= threshold', () => {
      expect(service.shouldBlock(0.3, 0.3)).toBe(true); // Exactly at threshold
      expect(service.shouldBlock(0.4, 0.3)).toBe(true); // Above threshold
      expect(service.shouldBlock(1.0, 0.3)).toBe(true); // 100% absent
    });

    it('should return false when absentPercentage < threshold', () => {
      expect(service.shouldBlock(0.29, 0.3)).toBe(false);
      expect(service.shouldBlock(0.1, 0.3)).toBe(false);
      expect(service.shouldBlock(0, 0.3)).toBe(false);
    });
  });
});
