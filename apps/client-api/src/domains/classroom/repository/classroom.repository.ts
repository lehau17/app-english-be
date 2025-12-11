import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { Classroom, Prisma } from '@prisma/client';
import { Readable } from 'stream';
import { LessonRepository } from '../../lesson/repository/lesson.repository';
import {
  ClassroomAnnouncementQueryDto,
  FilterClassroomRequestDto,
} from '../dto/classroom.dto';
import { AttendanceBlockingService } from '../service/attendance-blocking.service';

@Injectable()
export class ClassroomRepository {
  constructor(
    private readonly prisma: PrismaRepository,
    private readonly lessonRepository: LessonRepository,
    @Inject(forwardRef(() => AttendanceBlockingService))
    private readonly attendanceBlockingService?: AttendanceBlockingService,
  ) {}

  async create(data: Prisma.ClassroomCreateInput): Promise<Classroom> {
    return this.prisma.classroom.create({ data });
  }

  async createSessions(sessionsData: any[]): Promise<void> {
    await this.prisma.classroomSession.createMany({
      data: sessionsData,
      skipDuplicates: true,
    });
  }

  async getTeacherSchedule(
    teacherId: string,
    weekStart?: Date,
    weekEnd?: Date,
  ) {
    const startDate = weekStart || new Date();
    const endDate =
      weekEnd || new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get all classroom slots for this teacher
    const classroomSlots = await this.prisma.classroomSlot.findMany({
      where: {
        classroom: {
          teacherId: teacherId,
          isActive: true,
        },
        isActive: true,
      },
      include: {
        classroom: {
          select: {
            id: true,
            name: true,
            periodStart: true,
            periodEnd: true,
          },
        },
      },
    });

    // Get all sessions for this teacher in the date range
    const sessions = await this.prisma.classroomSession.findMany({
      where: {
        instructorId: teacherId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        classroom: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      teacherId,
      weekStart: startDate,
      weekEnd: endDate,
      classroomSlots,
      sessions,
    };
  }

  async getStudentDailySessions(
    studentId: string,
    dayStart: Date,
    dayEnd: Date,
  ) {
    return this.prisma.classroomSession.findMany({
      where: {
        startTime: {
          gte: dayStart,
          lt: dayEnd,
        },
        classroom: {
          students: {
            some: {
              studentId,
              isActive: true,
            },
          },
        },
      },
      include: {
        classroom: {
          select: {
            id: true,
            name: true,
          },
        },
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        attendance: {
          where: {
            studentId,
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  async getStudentWeeklySessions(studentId: string, start: Date, end: Date) {
    return this.prisma.classroomSession.findMany({
      where: {
        startTime: {
          gte: start,
          lt: end,
        },
        classroom: {
          students: {
            some: {
              studentId,
              isActive: true,
            },
          },
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        type: true,
        startTime: true,
        endTime: true,
        timezone: true,
        durationHours: true,
        meetingUrl: true,
        agenda: true,
        materials: true,
        metadata: true, // Include metadata với course session schedule info
        classroom: {
          select: {
            id: true,
            name: true,
            course: {
              select: {
                id: true,
                title: true,
                description: true,
              },
            },
          },
        },
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        attendance: {
          where: {
            studentId,
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  async findById(id: string): Promise<Classroom | null> {
    return this.prisma.classroom.findUnique({
      where: { id },
      include: { students: true, teacher: true },
    });
  }

  async update(
    id: string,
    data: Prisma.ClassroomUpdateInput,
  ): Promise<Classroom> {
    return this.prisma.classroom.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Classroom> {
    return this.prisma.classroom.delete({ where: { id } });
  }

  async getClassroomSessions(classroomId: string) {
    return this.prisma.classroomSession.findMany({
      where: { classroomId },
      orderBy: { startTime: 'asc' },
    });
  }

  async updateSession(sessionId: string, data: any) {
    return this.prisma.classroomSession.update({
      where: { id: sessionId },
      data,
    });
  }

  async list(
    params: FilterClassroomRequestDto,
  ): Promise<PageResponseDto<Classroom>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      teacherId,
      status,
      studentId,
      includePaymentStatus = false,
    } = params;

    const where: Prisma.ClassroomWhereInput = {
      teacherId,
      status,
      name: search ? { contains: search, mode: 'insensitive' } : undefined,
      ...(studentId && {
        students: {
          some: {
            studentId,
            isActive: true,
          },
        },
      }),
    };

    // Auto-update classroom status based on current date
    await this.updateClassroomStatuses();

    const totalItems = await this.prisma.classroom.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const classrooms = await this.prisma.classroom.findMany({
      where,
      skip: (safePage - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        students: includePaymentStatus
          ? {
              where: studentId ? { studentId } : undefined,
              select: {
                studentId: true,
                isPurchased: true,
                isActive: true,
                joinedAt: true,
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
            }
          : true,
        teacher: true,
        course: {
          select: {
            id: true,
            title: true,
            price: true,
            currency: true,
          },
        },
        _count: {
          select: {
            students: {
              where: { isActive: true },
            },
            assignments: true,
          },
        },
      },
    });

    // Transform data để xử lý logic isPurchased cho course miễn phí
    const transformedData = classrooms.map((classroom) => {
      if (includePaymentStatus && Array.isArray(classroom.students)) {
        const isCourseFree =
          !classroom.course?.price || classroom.course.price <= 0;

        return {
          ...classroom,
          students: classroom.students.map((cs: any) => ({
            ...cs,
            isPurchased: isCourseFree ? true : cs.isPurchased, // Course free thì auto purchased
          })),
        };
      }
      return classroom;
    });

    return PageResponseDto.of(transformedData, safePage, limit, totalItems);
  }

  async addStudents(
    classroomId: string,
    studentIds: string[],
    isPurchased: boolean = false,
  ) {
    const data = studentIds.map((studentId) => ({
      classroomId,
      studentId,
      isPurchased,
    }));
    return this.prisma.classroomStudent.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async getCourseByClassroomId(classroomId: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        course: {
          select: {
            id: true,
            price: true,
            title: true,
          },
        },
      },
    });
    return classroom?.course || null;
  }

  async removeStudent(classroomId: string, studentId: string) {
    return this.prisma.classroomStudent.delete({
      where: { classroomId_studentId: { classroomId, studentId } },
    });
  }

  streamAll(params: FilterClassroomRequestDto): Readable {
    const {
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      teacherId,
    } = params;
    const where: Prisma.ClassroomWhereInput = {
      teacherId,
      name: search ? { contains: search, mode: 'insensitive' } : undefined,
    };

    const batchSize = 100;
    let cursor: string | undefined;

    const stream = new Readable({ objectMode: true, read() {} });

    const fetchData = async () => {
      const results = await this.prisma.classroom.findMany({
        where,
        take: batchSize,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { [sortBy]: sortOrder },
        include: { students: true, teacher: true },
      });

      if (results.length === 0) {
        stream.push(null);
        return;
      }

      for (const item of results) {
        stream.push(item);
      }

      cursor = results[results.length - 1].id;
      fetchData();
    };

    fetchData().catch((err) => stream.emit('error', err));

    return stream;
  }

  async findClassroomsByStudentId(studentId: string) {
    return this.prisma.classroom.findMany({
      where: {
        students: {
          some: {
            studentId,
          },
        },
      },
      include: {
        teacher: true,
        _count: {
          select: { students: true, assignments: true },
        },
      },
    });
  }

  async isTeacherOfClassroom(
    classroomId: string,
    teacherId: string,
  ): Promise<boolean> {
    const count = await this.prisma.classroom.count({
      where: {
        id: classroomId,
        teacherId,
      },
    });
    return count > 0;
  }

  async isStudentInClassroom(
    classroomId: string,
    studentId: string,
  ): Promise<boolean> {
    const count = await this.prisma.classroomStudent.count({
      where: {
        classroomId,
        studentId,
        isActive: true,
      },
    });
    return count > 0;
  }

  async isTeacherOfStudent(
    teacherId: string,
    studentId: string,
  ): Promise<boolean> {
    const count = await this.prisma.classroom.count({
      where: {
        teacherId,
        students: {
          some: {
            studentId,
            isActive: true,
          },
        },
      },
    });
    return count > 0;
  }

  async isParentOfStudent(
    parentId: string,
    studentId: string,
  ): Promise<boolean> {
    const count = await this.prisma.parentChild.count({
      where: {
        parentId,
        childId: studentId,
      },
    });
    return count > 0;
  }

  async createAnnouncement(
    classroomId: string,
    payload: {
      title: string;
      content: string;
      priority?: string;
    },
  ) {
    const studentIds = await this.prisma.classroomStudent.findMany({
      where: { classroomId, isActive: true },
      select: { studentId: true },
    });
    if (studentIds.length > 0) {
      await this.prisma.notification.createMany({
        data: studentIds.map((s) => ({
          userId: s.studentId,
          type: 'assignment',
          title: payload.title,
          body: payload.content,
          channel: 'in_app',
          data: JSON.stringify({ classroomId }),
        })),
      });
    }
    return this.prisma.announcement.create({
      data: {
        classroomId,
        title: payload.title,
        content: payload.content,
        priority: payload.priority ?? 'normal',
        targetAll: true,
        targetIds: [],
      },
    });
  }

  async findAnnouncementsByClassroomId(
    classroomId: string,
    params: ClassroomAnnouncementQueryDto,
  ) {
    const { page = 1, limit = 10, priority } = params;

    const where: Prisma.AnnouncementWhereInput = {
      classroomId,
      priority: priority ? priority : undefined,
      title: params.search
        ? { contains: params.search, mode: 'insensitive' }
        : undefined,
    };

    const totalItems = await this.prisma.announcement.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const data = await this.prisma.announcement.findMany({
      where,
      skip: (safePage - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return PageResponseDto.of(data, safePage, limit, totalItems);
  }

  async findClassroomsByTeacherId(teacherId: string) {
    return this.prisma.classroom.findMany({
      where: {
        teacherId,
      },
      include: {
        teacher: true,
        _count: {
          select: { students: true, assignments: true },
        },
      },
    });
  }

  async getClassroomDetail(classroomId: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        slots: true,
        teacher: true,
        students: {
          include: { student: true },
        },
        assignments: {
          include: {
            submissions: true,
            assignmentActivities: true,
          },
        },
        announcements: true,
        course: {
          include: {
            lessons: {
              include: { activities: true },
            },
            sessionSchedules: {
              include: {
                activities: {
                  include: {
                    activity: true,
                  },
                },
              },
              orderBy: {
                sessionNumber: 'asc',
              },
            },
          },
        },
        sessions: {
          orderBy: {
            startTime: 'asc',
          },
        },
      },
    });

    if (!classroom) throw new BadRequestException('Classroom not found');

    // Format students
    const students = classroom.students.map((cs) => ({
      id: cs.student.id,
      firstName: cs.student.firstName,
      lastName: cs.student.lastName,
      displayName: cs.student.displayName,
      avatarUrl: cs.student.avatarUrl,
      studentRecord: {
        joinedAt: cs.joinedAt,
        isActive: cs.isActive,
        notes: cs.notes,
      },
    }));

    // Format assignments
    const assignments = classroom.assignments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      instructions: a.instructions,
      dueDate: a.dueDate,
      status: a.status,
      isPublished: a.isPublished,
      totalPoints: a.totalPoints,
      timeLimit: a.timeLimit,
      maxAttempts: a.maxAttempts,
      type: a.type,
      weight: a.weight,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      _count: { submissions: a.submissions.length },
      activities:
        a.assignmentActivities?.map((activity) => ({
          id: activity.id,
          type: activity.type,
          title: activity.title,
          instructions: activity.instructions,
          content: activity.content,
          points: activity.points,
          passingScore: activity.passingScore,
          difficulty: activity.difficulty,
          hints: activity.hints,
          createdAt: activity.createdAt,
          updatedAt: activity.updatedAt,
        })) ?? [],
    }));

    // Format announcements
    const announcements = classroom.announcements.map((an) => ({
      id: an.id,
      title: an.title,
      content: an.content,
      priority: an.priority,
      targetAll: an.targetAll,
      createdAt: an.createdAt,
      updatedAt: an.updatedAt,
    }));

    // Format lessons + activities
    const lessons =
      classroom.course?.lessons?.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        orderNo: lesson.orderNo,
        estimatedTime: lesson.estimatedTime,
        difficulty: lesson.difficulty,
        isLocked: lesson.isLocked,
        activities: lesson.activities.map((act) => ({
          id: act.id,
          lessonId: act.lessonId,
          orderNo: act.orderNo,
          type: act.type,
          title: act.title,
          passingScore: act.passingScore,
        })),
      })) ?? [];

    // Stats
    const _count = {
      students: students.length,
      assignments: assignments.length,
      announcements: announcements.length,
    };

    // Settings
    const settings = classroom.settings || {};

    // Schedule - return full slot details for each day
    const slots =
      classroom.slots?.map((slot) => ({
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        startMinuteOfDay: slot.startMinuteOfDay,
        endMinuteOfDay: slot.endMinuteOfDay,
        startTime:
          slot.startMinuteOfDay !== undefined
            ? `${Math.floor(slot.startMinuteOfDay / 60)}:${String(slot.startMinuteOfDay % 60).padStart(2, '0')}`
            : undefined,
        endTime:
          slot.endMinuteOfDay !== undefined
            ? `${Math.floor(slot.endMinuteOfDay / 60)}:${String(slot.endMinuteOfDay % 60).padStart(2, '0')}`
            : undefined,
        duration:
          slot.startMinuteOfDay !== undefined &&
          slot.endMinuteOfDay !== undefined
            ? Math.round(slot.endMinuteOfDay - slot.startMinuteOfDay)
            : undefined,
        isActive: slot.isActive,
      })) ?? [];

    return {
      id: classroom.id,
      name: classroom.name,
      description: classroom.description,
      classCode: classroom.classCode,
      status: classroom.status,
      teacher: classroom.teacher,
      isActive: classroom.isActive,
      maxStudents: classroom.maxStudents,
      createdAt: classroom.createdAt,
      updatedAt: classroom.updatedAt,
      expiresAt: classroom.expiresAt,
      settings,
      slots,
      _count,
      students,
      assignments,
      announcements,
      lessons,
      course: classroom.course,
    };
  }

  async findStudentByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, role: 'student' },
    });
  }

  async createStudent(data: any) {
    return this.prisma.user.create({
      data: {
        ...data,
        status: 'active',
      },
    });
  }

  /**
   * Auto-update classroom status based on current date
   */
  async updateClassroomStatuses(): Promise<void> {
    const now = new Date();

    // Update to ongoing for classrooms that started
    await this.prisma.classroom.updateMany({
      where: {
        status: 'upcoming',
        periodStart: { lte: now },
        periodEnd: { gt: now },
      },
      data: { status: 'ongoing' },
    });

    // Update to completed for classrooms that ended
    await this.prisma.classroom.updateMany({
      where: {
        status: { in: ['upcoming', 'ongoing'] },
        periodEnd: { lte: now },
      },
      data: { status: 'completed' },
    });
  }

  /**
   * Get classroom status with payment info for student
   */
  async getClassroomStatusForStudent(classroomId: string, studentId: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        students: {
          where: { studentId, isActive: true },
          select: {
            isPurchased: true,
            isBlocked: true,
            blockedAt: true,
            blockedReason: true,
            consecutiveAbsences: true,
          },
        },
        course: {
          select: { price: true },
        },
      },
    });

    if (!classroom) return null;

    const studentRecord = classroom.students[0];
    const needsPayment = classroom.course?.price && classroom.course.price > 0;

    // Get blocking status if service available
    let blockingStatus = null;
    if (this.attendanceBlockingService && studentRecord) {
      blockingStatus = await this.attendanceBlockingService.checkBlockingStatus(
        classroomId,
        studentId,
      );
    }

    return {
      id: classroom.id,
      status: classroom.status,
      isPurchased: studentRecord?.isPurchased || false,
      needsPayment: needsPayment || false,
      hasAccess:
        (!needsPayment || studentRecord?.isPurchased || false) &&
        !(blockingStatus?.isBlocked || studentRecord?.isBlocked || false),
      isBlocked: blockingStatus?.isBlocked || studentRecord?.isBlocked || false,
      blockedAt: blockingStatus?.blockedAt || studentRecord?.blockedAt || null,
      blockedReason:
        blockingStatus?.blockedReason || studentRecord?.blockedReason || null,
      consecutiveAbsences:
        blockingStatus?.consecutiveAbsences ||
        studentRecord?.consecutiveAbsences ||
        0,
      blockingThreshold: blockingStatus?.threshold || null,
    };
  }

  async getClassroomDetailForStudent(classroomId: string, studentId: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        slots: true,
        teacher: true,
        students: {
          include: { student: true },
        },
        assignments: {
          include: {
            submissions: {
              where: { studentId },
              orderBy: { attemptCount: 'desc' },
              take: 1,
            },
            assignmentActivities: true,
          },
        },
        announcements: true,
        course: {
          include: {
            lessons: {
              include: { activities: true },
            },
          },
        },
      },
    });

    if (!classroom) throw new BadRequestException('Classroom not found');

    // Format students
    const students = classroom.students.map((cs) => ({
      id: cs.student.id,
      firstName: cs.student.firstName,
      lastName: cs.student.lastName,
      displayName: cs.student.displayName,
      avatarUrl: cs.student.avatarUrl,
      studentRecord: {
        joinedAt: cs.joinedAt,
        isActive: cs.isActive,
        notes: cs.notes,
      },
    }));

    // Format assignments with student's submission data
    const assignments = classroom.assignments.map((a) => {
      const mySubmission = a.submissions.length > 0 ? a.submissions[0] : null;

      return {
        id: a.id,
        title: a.title,
        description: a.description,
        instructions: a.instructions,
        startTime: a.startTime,
        dueDate: a.dueDate,
        status: a.status,
        isPublished: a.isPublished,
        totalPoints: a.totalPoints,
        timeLimit: a.timeLimit,
        maxAttempts: a.maxAttempts,
        createdAt: a.createdAt,
        _count: { submissions: 1 }, // For student view, just indicate if they have submitted
        submission: mySubmission
          ? {
              id: mySubmission.id,
              score: mySubmission.score,
              status: mySubmission.score !== null ? 'graded' : 'submitted',
              attempt: mySubmission.attemptCount,
              submittedAt: mySubmission.submittedAt?.toISOString() || null,
            }
          : null,
        activities:
          a.assignmentActivities?.map((activity) => ({
            id: activity.id,
            type: activity.type,
            title: activity.title,
            instructions: activity.instructions,
            content: activity.content,
            points: activity.points,
            passingScore: activity.passingScore,
            difficulty: activity.difficulty,
            hints: activity.hints,
            createdAt: activity.createdAt,
            updatedAt: activity.updatedAt,
          })) ?? [],
      };
    });

    // Format announcements
    const announcements = classroom.announcements.map((an) => ({
      id: an.id,
      title: an.title,
      content: an.content,
      priority: an.priority,
      targetAll: an.targetAll,
      createdAt: an.createdAt,
      updatedAt: an.updatedAt,
    }));

    // Format lessons + activities với progress unlocking logic
    const lessons = classroom.course?.lessons?.length
      ? await this.lessonRepository.listLessonsOfCourseWithProgress(
          classroom.course.id,
          studentId,
        )
      : [];

    const formattedLessons = lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      orderNo: lesson.orderNo,
      estimatedTime: lesson.estimatedTime,
      difficulty: lesson.difficulty,
      isLocked: lesson.isLocked, // Sử dụng dynamic isLocked từ progress logic
      activities:
        lesson.activities?.map((activity) => ({
          id: activity.id,
          type: activity.type,
          passingScore: activity.passingScore,
        })) ?? [],
      // Thêm progress data nếu có (using type assertion for dynamic property)
      ...((lesson as any).progress && { progress: (lesson as any).progress }),
    }));

    const settings = (classroom.settings as any) || {};

    // Format slots with full details
    const slots =
      classroom.slots?.map((slot) => ({
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        startMinuteOfDay: slot.startMinuteOfDay,
        endMinuteOfDay: slot.endMinuteOfDay,
        startTime:
          slot.startMinuteOfDay !== undefined
            ? `${Math.floor(slot.startMinuteOfDay / 60)}:${String(slot.startMinuteOfDay % 60).padStart(2, '0')}`
            : undefined,
        endTime:
          slot.endMinuteOfDay !== undefined
            ? `${Math.floor(slot.endMinuteOfDay / 60)}:${String(slot.endMinuteOfDay % 60).padStart(2, '0')}`
            : undefined,
        duration:
          slot.startMinuteOfDay !== undefined &&
          slot.endMinuteOfDay !== undefined
            ? Math.round(slot.endMinuteOfDay - slot.startMinuteOfDay)
            : undefined,
        isActive: slot.isActive,
      })) ?? [];

    const _count = {
      students: students.length,
      assignments: assignments.length,
      announcements: announcements.length,
    };

    return {
      id: classroom.id,
      name: classroom.name,
      description: classroom.description,
      classCode: classroom.classCode,
      status: classroom.status,
      teacher: classroom.teacher,
      isActive: classroom.isActive,
      maxStudents: classroom.maxStudents,
      createdAt: classroom.createdAt,
      updatedAt: classroom.updatedAt,
      expiresAt: classroom.expiresAt,
      course: classroom.course,
      settings,
      slots,
      _count,
      students,
      assignments,
      announcements,
      lessons: formattedLessons,
    };
  }
}
