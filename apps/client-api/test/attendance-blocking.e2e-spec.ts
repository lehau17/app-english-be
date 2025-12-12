/**
 * E2E Integration Tests: Attendance Blocking API
 *
 * Tests the blocking-status endpoint with real database operations
 * to verify the bug fix: absent percentage calculated based on TOTAL sessions (not just past).
 *
 * Correct Behavior: 1 absent / 8 total sessions = 12.5% (should NOT block at 30% threshold)
 * Previous (WRONG): 1 absent / 1 past session = 100% (incorrectly blocked)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaRepository } from '@app/database';
import { ClassroomModule } from '../src/domains/classroom/classroom.module';
import { SharedModule } from '@app/shared';

describe('Attendance Blocking API (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaRepository;

  // Test data references (created in beforeEach)
  let testUserId: string;
  let testTeacherId: string;
  let testCourseId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ClassroomModule, SharedModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaRepository>(PrismaRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Create test user (student)
    const student = await prisma.user.create({
      data: {
        email: `student-${Date.now()}@test.com`,
        displayName: 'Test Student',
        firstName: 'Test',
        lastName: 'Student',
        role: 'student',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
    });
    testUserId = student.id;

    // Create test teacher
    const teacher = await prisma.user.create({
      data: {
        email: `teacher-${Date.now()}@test.com`,
        displayName: 'Test Teacher',
        firstName: 'Test',
        lastName: 'Teacher',
        role: 'teacher',
        avatarUrl: 'https://example.com/teacher.jpg',
      },
    });
    testTeacherId = teacher.id;

    // Create test course
    const course = await prisma.course.create({
      data: {
        title: 'Test English Course',
        description: 'E2E Test Course',
        level: 'beginner',
        imageUrl: 'https://example.com/course.jpg',
      },
    });
    testCourseId = course.id;
  });

  afterEach(async () => {
    // Cleanup test data in reverse dependency order
    await prisma.sessionAttendance.deleteMany({
      where: {
        studentId: testUserId,
      },
    });

    await prisma.classroomStudent.deleteMany({
      where: {
        studentId: testUserId,
      },
    });

    await prisma.classroomSession.deleteMany({
      where: {
        classroom: {
          teacherId: testTeacherId,
        },
      },
    });

    await prisma.classroom.deleteMany({
      where: {
        teacherId: testTeacherId,
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [testUserId, testTeacherId] },
      },
    });

    await prisma.course.deleteMany({
      where: {
        id: testCourseId,
      },
    });
  });

  describe('GET /api/private/v1/classrooms/:id/students/:studentId/blocking-status', () => {
    /**
     * Scenario 1: Student Missed All Past Sessions (100% Absent)
     *
     * Setup:
     * - Classroom: 8 total sessions
     * - Past sessions: 1 (7 future)
     * - Student attendance: 0 records (counted as absent)
     *
     * Expected: isBlocked = true, absentPercentage = 100%
     * Calculation: 1/1 = 100% (≥30% threshold → blocked)
     */
    it('should block when student missed all past sessions (100%)', async () => {
      // Arrange: Create classroom with 8 sessions (1 past, 7 future)
      const now = new Date('2025-12-12T12:00:00Z');
      const classroom = await prisma.classroom.create({
        data: {
          name: 'E2E Test Classroom - Scenario 1',
          description: 'Test classroom for attendance blocking',
          courseId: testCourseId,
          teacherId: testTeacherId,
          maxStudents: 20,
          settings: {},
        },
      });

      // Create 1 past session
      await prisma.classroomSession.create({
        data: {
          classroomId: classroom.id,
          startTime: new Date('2025-12-01T10:00:00Z'), // Past
          endTime: new Date('2025-12-01T11:30:00Z'),
        },
      });

      // Create 7 future sessions
      for (let i = 1; i <= 7; i++) {
        await prisma.classroomSession.create({
          data: {
            classroomId: classroom.id,
            startTime: new Date(`2025-12-${13 + i}T10:00:00Z`), // Future
            endTime: new Date(`2025-12-${13 + i}T11:30:00Z`),
          },
        });
      }

      // Enroll student (no attendance records = absent)
      await prisma.classroomStudent.create({
        data: {
          classroomId: classroom.id,
          studentId: testUserId,
          isActive: true,
          isBlocked: false,
          consecutiveAbsences: 0,
        },
      });

      // Act: Get blocking status
      const response = await request(app.getHttpServer())
        .get(
          `/api/private/v1/classrooms/${classroom.id}/students/${testUserId}/blocking-status`,
        )
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        isBlocked: true,
        consecutiveAbsences: 1, // Total absences from past sessions
        threshold: 30,
        pastSessionsCount: 1, // Only 1 past session counted
      });

      // Verify blocked reason includes percentage
      expect(response.body.blockedReason).toContain('100%');
      expect(response.body.blockedAt).toBeDefined();
    });

    /**
     * Scenario 2: Student Missed 1 of 3 Past Sessions (33.3% Absent)
     *
     * Setup:
     * - Classroom: 8 total sessions
     * - Past sessions: 3 (5 future)
     * - Student attendance: 2 present, 1 absent
     *
     * Expected: isBlocked = true, absentPercentage = 33.33%
     * Calculation: 1/3 = 33.3% (≥30% threshold → blocked)
     */
    it('should block when student missed 1 of 3 past sessions (33.3%)', async () => {
      // Arrange: Create classroom with 8 sessions (3 past, 5 future)
      const classroom = await prisma.classroom.create({
        data: {
          name: 'E2E Test Classroom - Scenario 2',
          description: 'Test classroom for attendance blocking',
          courseId: testCourseId,
          teacherId: testTeacherId,
          maxStudents: 20,
          settings: {},
        },
      });

      // Create 3 past sessions
      const pastSessionIds: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const session = await prisma.classroomSession.create({
          data: {
            classroomId: classroom.id,
            startTime: new Date(`2025-12-0${i}T10:00:00Z`), // Past
            endTime: new Date(`2025-12-0${i}T11:30:00Z`),
          },
        });
        pastSessionIds.push(session.id);
      }

      // Create 5 future sessions
      for (let i = 1; i <= 5; i++) {
        await prisma.classroomSession.create({
          data: {
            classroomId: classroom.id,
            startTime: new Date(`2025-12-${13 + i}T10:00:00Z`), // Future
            endTime: new Date(`2025-12-${13 + i}T11:30:00Z`),
          },
        });
      }

      // Enroll student
      await prisma.classroomStudent.create({
        data: {
          classroomId: classroom.id,
          studentId: testUserId,
          isActive: true,
          isBlocked: false,
          consecutiveAbsences: 0,
        },
      });

      // Mark attendance: 2 present, 1 absent (no record)
      await prisma.sessionAttendance.create({
        data: {
          sessionId: pastSessionIds[0],
          studentId: testUserId,
          status: 'present',
          checkInTime: new Date('2025-12-01T10:05:00Z'),
        },
      });

      await prisma.sessionAttendance.create({
        data: {
          sessionId: pastSessionIds[1],
          studentId: testUserId,
          status: 'present',
          checkInTime: new Date('2025-12-02T10:05:00Z'),
        },
      });

      // pastSessionIds[2] has no attendance record = absent

      // Act: Get blocking status
      const response = await request(app.getHttpServer())
        .get(
          `/api/private/v1/classrooms/${classroom.id}/students/${testUserId}/blocking-status`,
        )
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        isBlocked: true,
        consecutiveAbsences: 1, // 1 absence
        threshold: 30,
        pastSessionsCount: 3, // 3 past sessions counted
      });

      // Verify percentage in blocked reason
      expect(response.body.blockedReason).toMatch(/33%/);
    });

    /**
     * Scenario 3: Student Missed 1 of 8 Past Sessions (12.5% Absent)
     *
     * Setup:
     * - Classroom: 8 total sessions
     * - Past sessions: 8 (all occurred, 0 future)
     * - Student attendance: 7 present, 1 absent
     *
     * Expected: isBlocked = false, absentPercentage = 12.5%
     * Calculation: 1/8 = 12.5% (<30% threshold → NOT blocked)
     */
    it('should NOT block when student missed 1 of 8 sessions (12.5%)', async () => {
      // Arrange: Create classroom with 8 past sessions
      const classroom = await prisma.classroom.create({
        data: {
          name: 'E2E Test Classroom - Scenario 3',
          description: 'Test classroom for attendance blocking',
          courseId: testCourseId,
          teacherId: testTeacherId,
          maxStudents: 20,
          settings: {},
        },
      });

      // Create 8 past sessions
      const pastSessionIds: string[] = [];
      for (let i = 1; i <= 8; i++) {
        const session = await prisma.classroomSession.create({
          data: {
            classroomId: classroom.id,
            startTime: new Date(`2025-12-0${i}T10:00:00Z`), // Past
            endTime: new Date(`2025-12-0${i}T11:30:00Z`),
          },
        });
        pastSessionIds.push(session.id);
      }

      // Enroll student
      await prisma.classroomStudent.create({
        data: {
          classroomId: classroom.id,
          studentId: testUserId,
          isActive: true,
          isBlocked: false,
          consecutiveAbsences: 0,
        },
      });

      // Mark attendance: 7 present, 1 absent (no record at index 3)
      for (let i = 0; i < pastSessionIds.length; i++) {
        if (i === 3) continue; // Skip one = absent

        await prisma.sessionAttendance.create({
          data: {
            sessionId: pastSessionIds[i],
            studentId: testUserId,
            status: 'present',
            checkInTime: new Date(`2025-12-0${i + 1}T10:05:00Z`),
          },
        });
      }

      // Act: Get blocking status
      const response = await request(app.getHttpServer())
        .get(
          `/api/private/v1/classrooms/${classroom.id}/students/${testUserId}/blocking-status`,
        )
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        isBlocked: false, // 12.5% < 30% threshold
        consecutiveAbsences: 1, // 1 absence
        threshold: 30,
        pastSessionsCount: 8, // All 8 sessions counted
      });

      expect(response.body.blockedAt).toBeUndefined();
    });

    /**
     * Scenario 4: No Past Sessions (Early Course)
     *
     * Setup:
     * - Classroom: 8 total sessions
     * - Past sessions: 0 (all future)
     * - Student attendance: None
     *
     * Expected: isBlocked = false, absentPercentage = 0%
     * Calculation: 0/0 = 0 (zero-division guard, NOT blocked)
     */
    it('should return 0% when no past sessions exist', async () => {
      // Arrange: Create classroom with only future sessions
      const classroom = await prisma.classroom.create({
        data: {
          name: 'E2E Test Classroom - Scenario 4',
          description: 'Test classroom for attendance blocking',
          courseId: testCourseId,
          teacherId: testTeacherId,
          maxStudents: 20,
          settings: {},
        },
      });

      // Create 8 future sessions
      for (let i = 1; i <= 8; i++) {
        await prisma.classroomSession.create({
          data: {
            classroomId: classroom.id,
            startTime: new Date(`2025-12-${13 + i}T10:00:00Z`), // All future
            endTime: new Date(`2025-12-${13 + i}T11:30:00Z`),
          },
        });
      }

      // Enroll student
      await prisma.classroomStudent.create({
        data: {
          classroomId: classroom.id,
          studentId: testUserId,
          isActive: true,
          isBlocked: false,
          consecutiveAbsences: 0,
        },
      });

      // Act: Get blocking status
      const response = await request(app.getHttpServer())
        .get(
          `/api/private/v1/classrooms/${classroom.id}/students/${testUserId}/blocking-status`,
        )
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        isBlocked: false, // Zero division guard
        consecutiveAbsences: 0, // No absences
        threshold: 30,
        pastSessionsCount: 0, // No past sessions
      });
    });

    /**
     * Scenario 5: Perfect Attendance (0% Absent)
     *
     * Setup:
     * - Classroom: 8 total sessions
     * - Past sessions: 5 (3 future)
     * - Student attendance: 5 present, 0 absent
     *
     * Expected: isBlocked = false, absentPercentage = 0%
     * Calculation: 0/5 = 0% (<30% threshold → NOT blocked)
     */
    it('should return 0% when perfect attendance', async () => {
      // Arrange: Create classroom with mixed sessions
      const classroom = await prisma.classroom.create({
        data: {
          name: 'E2E Test Classroom - Scenario 5',
          description: 'Test classroom for attendance blocking',
          courseId: testCourseId,
          teacherId: testTeacherId,
          maxStudents: 20,
          settings: {},
        },
      });

      // Create 5 past sessions
      const pastSessionIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const session = await prisma.classroomSession.create({
          data: {
            classroomId: classroom.id,
            startTime: new Date(`2025-12-0${i}T10:00:00Z`), // Past
            endTime: new Date(`2025-12-0${i}T11:30:00Z`),
          },
        });
        pastSessionIds.push(session.id);
      }

      // Create 3 future sessions
      for (let i = 1; i <= 3; i++) {
        await prisma.classroomSession.create({
          data: {
            classroomId: classroom.id,
            startTime: new Date(`2025-12-${13 + i}T10:00:00Z`), // Future
            endTime: new Date(`2025-12-${13 + i}T11:30:00Z`),
          },
        });
      }

      // Enroll student
      await prisma.classroomStudent.create({
        data: {
          classroomId: classroom.id,
          studentId: testUserId,
          isActive: true,
          isBlocked: false,
          consecutiveAbsences: 0,
        },
      });

      // Mark all past sessions as present
      for (let i = 0; i < pastSessionIds.length; i++) {
        await prisma.sessionAttendance.create({
          data: {
            sessionId: pastSessionIds[i],
            studentId: testUserId,
            status: 'present',
            checkInTime: new Date(`2025-12-0${i + 1}T10:05:00Z`),
          },
        });
      }

      // Act: Get blocking status
      const response = await request(app.getHttpServer())
        .get(
          `/api/private/v1/classrooms/${classroom.id}/students/${testUserId}/blocking-status`,
        )
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        isBlocked: false, // Perfect attendance
        consecutiveAbsences: 0, // No absences
        threshold: 30,
        pastSessionsCount: 5, // 5 past sessions counted
      });
    });

    /**
     * Scenario 6: Edge Case - Exactly at Threshold (30% Absent)
     *
     * Setup:
     * - Classroom: 10 total sessions
     * - Past sessions: 10 (all occurred)
     * - Student attendance: 7 present, 3 absent
     *
     * Expected: isBlocked = true, absentPercentage = 30%
     * Calculation: 3/10 = 30% (=30% threshold → blocked, assuming >= logic)
     */
    it('should block when exactly at threshold (30%)', async () => {
      // Arrange: Create classroom with 10 past sessions
      const classroom = await prisma.classroom.create({
        data: {
          name: 'E2E Test Classroom - Scenario 6',
          description: 'Test classroom for attendance blocking',
          courseId: testCourseId,
          teacherId: testTeacherId,
          maxStudents: 20,
          settings: {},
        },
      });

      // Create 10 past sessions
      const pastSessionIds: string[] = [];
      for (let i = 1; i <= 10; i++) {
        const session = await prisma.classroomSession.create({
          data: {
            classroomId: classroom.id,
            startTime: new Date(`2025-12-0${i}T10:00:00Z`), // Past
            endTime: new Date(`2025-12-0${i}T11:30:00Z`),
          },
        });
        pastSessionIds.push(session.id);
      }

      // Enroll student
      await prisma.classroomStudent.create({
        data: {
          classroomId: classroom.id,
          studentId: testUserId,
          isActive: true,
          isBlocked: false,
          consecutiveAbsences: 0,
        },
      });

      // Mark attendance: 7 present, 3 absent (indices 2, 5, 8)
      const absentIndices = [2, 5, 8];
      for (let i = 0; i < pastSessionIds.length; i++) {
        if (absentIndices.includes(i)) continue; // Skip = absent

        await prisma.sessionAttendance.create({
          data: {
            sessionId: pastSessionIds[i],
            studentId: testUserId,
            status: 'present',
            checkInTime: new Date(`2025-12-0${i + 1}T10:05:00Z`),
          },
        });
      }

      // Act: Get blocking status
      const response = await request(app.getHttpServer())
        .get(
          `/api/private/v1/classrooms/${classroom.id}/students/${testUserId}/blocking-status`,
        )
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        isBlocked: true, // Exactly 30% = blocked (>= threshold)
        consecutiveAbsences: 3, // 3 absences
        threshold: 30,
        pastSessionsCount: 10, // 10 past sessions counted
      });

      // Verify percentage in blocked reason
      expect(response.body.blockedReason).toMatch(/30%/);
    });
  });

  describe('Auto-blocking behavior', () => {
    /**
     * Test auto-blocking when absent percentage exceeds threshold
     *
     * Verifies that checkBlockingStatus() auto-blocks the student
     * when absent percentage >= 30%
     */
    it('should auto-block student when absent percentage exceeds threshold', async () => {
      // Arrange: Create classroom and student
      const classroom = await prisma.classroom.create({
        data: {
          name: 'Auto-Block Test Classroom',
          description: 'Test classroom for auto-blocking',
          courseId: testCourseId,
          teacherId: testTeacherId,
          maxStudents: 20,
          settings: {},
        },
      });

      // Create 5 past sessions
      const pastSessionIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const session = await prisma.classroomSession.create({
          data: {
            classroomId: classroom.id,
            startTime: new Date(`2025-12-0${i}T10:00:00Z`), // Past
            endTime: new Date(`2025-12-0${i}T11:30:00Z`),
          },
        });
        pastSessionIds.push(session.id);
      }

      // Enroll student (initially not blocked)
      await prisma.classroomStudent.create({
        data: {
          classroomId: classroom.id,
          studentId: testUserId,
          isActive: true,
          isBlocked: false,
          consecutiveAbsences: 0,
        },
      });

      // Mark attendance: 3 present, 2 absent (40% absent)
      const absentIndices = [1, 3];
      for (let i = 0; i < pastSessionIds.length; i++) {
        if (absentIndices.includes(i)) continue; // Skip = absent

        await prisma.sessionAttendance.create({
          data: {
            sessionId: pastSessionIds[i],
            studentId: testUserId,
            status: 'present',
            checkInTime: new Date(`2025-12-0${i + 1}T10:05:00Z`),
          },
        });
      }

      // Act: Call blocking status endpoint (should trigger auto-block)
      const response = await request(app.getHttpServer())
        .get(
          `/api/private/v1/classrooms/${classroom.id}/students/${testUserId}/blocking-status`,
        )
        .expect(200);

      // Assert: Student should be auto-blocked
      expect(response.body.isBlocked).toBe(true);
      expect(response.body.consecutiveAbsences).toBe(2);
      expect(response.body.blockedReason).toContain('40%');

      // Verify database was updated
      const studentRecord = await prisma.classroomStudent.findUnique({
        where: {
          classroomId_studentId: {
            classroomId: classroom.id,
            studentId: testUserId,
          },
        },
      });

      expect(studentRecord?.isBlocked).toBe(true);
      expect(studentRecord?.blockedAt).toBeDefined();
      expect(studentRecord?.blockedReason).toContain('40%');
    });

    /**
     * Test auto-unblocking when absent percentage drops below threshold
     *
     * Verifies that checkBlockingStatus() auto-unblocks the student
     * when absent percentage improves below 30%
     */
    it('should auto-unblock student when absent percentage drops below threshold', async () => {
      // Arrange: Create classroom and student
      const classroom = await prisma.classroom.create({
        data: {
          name: 'Auto-Unblock Test Classroom',
          description: 'Test classroom for auto-unblocking',
          courseId: testCourseId,
          teacherId: testTeacherId,
          maxStudents: 20,
          settings: {},
        },
      });

      // Create 5 past sessions
      const pastSessionIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const session = await prisma.classroomSession.create({
          data: {
            classroomId: classroom.id,
            startTime: new Date(`2025-12-0${i}T10:00:00Z`), // Past
            endTime: new Date(`2025-12-0${i}T11:30:00Z`),
          },
        });
        pastSessionIds.push(session.id);
      }

      // Enroll student (initially blocked due to high absence)
      await prisma.classroomStudent.create({
        data: {
          classroomId: classroom.id,
          studentId: testUserId,
          isActive: true,
          isBlocked: true, // Initially blocked
          blockedAt: new Date('2025-12-05T12:00:00Z'),
          blockedReason: 'Vắng 2/3 buổi (66%)',
          consecutiveAbsences: 2,
        },
      });

      // Mark attendance: 4 present, 1 absent (20% absent - below threshold)
      const absentIndices = [1];
      for (let i = 0; i < pastSessionIds.length; i++) {
        if (absentIndices.includes(i)) continue; // Skip = absent

        await prisma.sessionAttendance.create({
          data: {
            sessionId: pastSessionIds[i],
            studentId: testUserId,
            status: 'present',
            checkInTime: new Date(`2025-12-0${i + 1}T10:05:00Z`),
          },
        });
      }

      // Act: Call blocking status endpoint (should trigger auto-unblock)
      const response = await request(app.getHttpServer())
        .get(
          `/api/private/v1/classrooms/${classroom.id}/students/${testUserId}/blocking-status`,
        )
        .expect(200);

      // Assert: Student should be auto-unblocked
      expect(response.body.isBlocked).toBe(false);
      expect(response.body.consecutiveAbsences).toBe(1); // 1 absence (20%)

      // Verify database was updated
      const studentRecord = await prisma.classroomStudent.findUnique({
        where: {
          classroomId_studentId: {
            classroomId: classroom.id,
            studentId: testUserId,
          },
        },
      });

      expect(studentRecord?.isBlocked).toBe(false);
      expect(studentRecord?.blockedAt).toBeNull();
      expect(studentRecord?.blockedReason).toBeNull();
    });

    /**
     * Test that manually blocked students are NOT auto-unblocked
     *
     * Verifies that manual blocks (with "Thủ công" in reason) persist
     * even when attendance improves.
     */
    it('should NOT auto-unblock manually blocked students', async () => {
      // Arrange: Create classroom and student
      const classroom = await prisma.classroom.create({
        data: {
          name: 'Manual Block Test Classroom',
          description: 'Test classroom for manual blocking',
          courseId: testCourseId,
          teacherId: testTeacherId,
          maxStudents: 20,
          settings: {},
        },
      });

      // Create 5 past sessions
      const pastSessionIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const session = await prisma.classroomSession.create({
          data: {
            classroomId: classroom.id,
            startTime: new Date(`2025-12-0${i}T10:00:00Z`), // Past
            endTime: new Date(`2025-12-0${i}T11:30:00Z`),
          },
        });
        pastSessionIds.push(session.id);
      }

      // Enroll student (manually blocked)
      await prisma.classroomStudent.create({
        data: {
          classroomId: classroom.id,
          studentId: testUserId,
          isActive: true,
          isBlocked: true,
          blockedAt: new Date('2025-12-05T12:00:00Z'),
          blockedReason: 'Thủ công: Discipline issue (bởi teacher@example.com)', // Manual block indicator
          consecutiveAbsences: 0,
        },
      });

      // Mark perfect attendance (5 present, 0 absent)
      for (let i = 0; i < pastSessionIds.length; i++) {
        await prisma.sessionAttendance.create({
          data: {
            sessionId: pastSessionIds[i],
            studentId: testUserId,
            status: 'present',
            checkInTime: new Date(`2025-12-0${i + 1}T10:05:00Z`),
          },
        });
      }

      // Act: Call blocking status endpoint
      const response = await request(app.getHttpServer())
        .get(
          `/api/private/v1/classrooms/${classroom.id}/students/${testUserId}/blocking-status`,
        )
        .expect(200);

      // Assert: Student should remain blocked (manual block)
      expect(response.body.isBlocked).toBe(true);
      expect(response.body.blockedReason).toContain('Thủ công');
      expect(response.body.consecutiveAbsences).toBe(0); // Perfect attendance

      // Verify database state unchanged
      const studentRecord = await prisma.classroomStudent.findUnique({
        where: {
          classroomId_studentId: {
            classroomId: classroom.id,
            studentId: testUserId,
          },
        },
      });

      expect(studentRecord?.isBlocked).toBe(true);
      expect(studentRecord?.blockedReason).toContain('Thủ công');
    });
  });

  describe('Edge cases and error handling', () => {
    /**
     * Test handling of student not enrolled in classroom
     */
    it('should return not blocked for non-enrolled student', async () => {
      // Arrange: Create classroom without enrolling student
      const classroom = await prisma.classroom.create({
        data: {
          name: 'Non-Enrollment Test Classroom',
          description: 'Test classroom',
          courseId: testCourseId,
          teacherId: testTeacherId,
          maxStudents: 20,
          settings: {},
        },
      });

      // Act: Get blocking status for non-enrolled student
      const response = await request(app.getHttpServer())
        .get(
          `/api/private/v1/classrooms/${classroom.id}/students/${testUserId}/blocking-status`,
        )
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        isBlocked: false,
        consecutiveAbsences: 0,
        threshold: 30,
        pastSessionsCount: 0,
      });
    });

    /**
     * Test handling of excused absences (should not count)
     */
    it('should NOT count excused absences in blocking calculation', async () => {
      // Arrange: Create classroom
      const classroom = await prisma.classroom.create({
        data: {
          name: 'Excused Absence Test Classroom',
          description: 'Test classroom',
          courseId: testCourseId,
          teacherId: testTeacherId,
          maxStudents: 20,
          settings: {},
        },
      });

      // Create 3 past sessions
      const pastSessionIds: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const session = await prisma.classroomSession.create({
          data: {
            classroomId: classroom.id,
            startTime: new Date(`2025-12-0${i}T10:00:00Z`),
            endTime: new Date(`2025-12-0${i}T11:30:00Z`),
          },
        });
        pastSessionIds.push(session.id);
      }

      // Enroll student
      await prisma.classroomStudent.create({
        data: {
          classroomId: classroom.id,
          studentId: testUserId,
          isActive: true,
          isBlocked: false,
          consecutiveAbsences: 0,
        },
      });

      // Mark attendance: 1 present, 1 excused, 1 absent
      await prisma.sessionAttendance.create({
        data: {
          sessionId: pastSessionIds[0],
          studentId: testUserId,
          status: 'present',
          checkInTime: new Date('2025-12-01T10:05:00Z'),
        },
      });

      await prisma.sessionAttendance.create({
        data: {
          sessionId: pastSessionIds[1],
          studentId: testUserId,
          status: 'excused', // Excused absence (should NOT count)
          notes: 'Doctor appointment',
        },
      });

      // pastSessionIds[2] has no record = absent (should count)

      // Act: Get blocking status
      const response = await request(app.getHttpServer())
        .get(
          `/api/private/v1/classrooms/${classroom.id}/students/${testUserId}/blocking-status`,
        )
        .expect(200);

      // Assert: Only 1 absence (excused not counted)
      expect(response.body).toMatchObject({
        isBlocked: true, // 1/3 = 33.3% >= 30%
        consecutiveAbsences: 1, // Only unexcused absence counted
        threshold: 30,
        pastSessionsCount: 3,
      });
    });
  });
});
