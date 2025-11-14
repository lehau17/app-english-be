import { PrismaRepository } from '@app/database';
import { JwtPayload } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Classroom,
  ClassroomStatus,
  Prisma,
  SessionStatus,
  TimezoneCode,
  UserRole,
} from '@prisma/client';
import { EventsGateway } from 'apps/client-api/src/events/events.gateway';
import * as bcrypt from 'bcrypt';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import {
  AddStudentToClassroomDto,
  AssignTeacherToClassroomDto,
  ClassroomAnnouncementQueryDto,
  CreateClassroomDto,
  FilterClassroomRequestDto,
  ImportStudentsResultDto,
  StudentDailyScheduleQueryDto,
  StudentWeeklyScheduleQueryDto,
  UpdateClassroomDto,
} from '../dto/classroom.dto';
import { ClassroomRepository } from '../repository/classroom.repository';
import { AutoExamCreationService } from '../services/auto-exam-creation.service';
import {
  calculateClassroomSchedule,
  generateClassroomSessions,
} from '../utils/classroom-schedule.util';
import {
  generateClassCode,
  getCsvTransformStream,
} from '../utils/classroom.util';

const TIMEZONE_OFFSETS: Record<TimezoneCode, number> = {
  [TimezoneCode.Asia_Ho_Chi_Minh]: 7 * 60,
  [TimezoneCode.Asia_Tokyo]: 9 * 60,
  [TimezoneCode.Asia_Seoul]: 9 * 60,
  [TimezoneCode.America_New_York]: -4 * 60,
  [TimezoneCode.Europe_London]: 0,
  [TimezoneCode.America_Los_Angeles]: -7 * 60,
  [TimezoneCode.Australia_Sydney]: 10 * 60,
};

@Injectable()
export class ClassroomService {
  constructor(
    private readonly classroomRepository: ClassroomRepository,
    private readonly gateway: EventsGateway,
    private readonly prisma: PrismaRepository,
    private readonly autoExamCreationService: AutoExamCreationService,
  ) {}

  async create(dto: CreateClassroomDto): Promise<Classroom> {
    // Lấy thông tin khóa học bao gồm session schedules
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      include: {
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
    });

    if (!course) {
      throw new NotFoundException(`Course with id ${dto.courseId} not found`);
    }

    // Nếu người dùng yêu cầu tính toán tự động thời gian dựa trên khóa học
    let periodStart = dto.periodStart;
    let periodEnd = dto.periodEnd;

    if (dto.autoCalculateDates) {
      // Nếu khóa học có plannedSessions, sử dụng nó để tính toán
      if (course.plannedSessions) {
        const { autoCalculateClassroomPeriod } = await import('../utils');
        const calculatedDates = autoCalculateClassroomPeriod(
          course.plannedSessions,
          dto.slots,
          periodStart,
          periodEnd,
        );

        periodStart = calculatedDates.periodStart;
        periodEnd = calculatedDates.periodEnd;
      }
    }

    // Calculate planned sessions and hours from period and slots
    const scheduleCalculation = calculateClassroomSchedule(
      periodStart,
      periodEnd,
      dto.slots,
    );

    const createPayload: Prisma.ClassroomCreateInput = {
      name: dto.name,
      description: dto.description,
      teacher: {
        connect: {
          id: dto.teacherId,
        },
      },
      course: {
        connect: {
          id: dto.courseId,
        },
      },
      classCode: generateClassCode(6),
      maxStudents: dto.maxStudents,
      isActive: dto.isActive ?? true,
      periodStart,
      periodEnd,
      // Auto-calculated from schedule
      plannedHours: scheduleCalculation.plannedHours,
      plannedSessions: scheduleCalculation.plannedSessions,
      // Create slots
      slots: {
        create: dto.slots.map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          startMinuteOfDay: slot.startMinuteOfDay,
          endMinuteOfDay: slot.endMinuteOfDay,
          isActive: true,
        })),
      },
    };

    const classroom = await this.classroomRepository.create(createPayload);

    // Generate sessions asynchronously (optional - you could make this background job)
    try {
      const sessionData = generateClassroomSessions(
        classroom.id,
        dto.teacherId,
        scheduleCalculation,
      );

      // Create sessions in batch
      await this.classroomRepository.createSessions(sessionData);

      // If course has session schedules, map them to classroom sessions
      if (
        course.sessionSchedules &&
        Array.isArray(course.sessionSchedules) &&
        course.sessionSchedules.length > 0
      ) {
        console.log(
          `🔄 Mapping ${course.sessionSchedules.length} session schedules to classroom ${classroom.id}`,
        );

        // Lấy lại danh sách sessions vừa tạo để mapping
        const createdSessions =
          await this.classroomRepository.getClassroomSessions(classroom.id);
        console.log(
          `📝 Found ${createdSessions.length} created sessions to map`,
        );

        await this.mapCourseSessionSchedulesToClassroom(
          classroom.id,
          course.sessionSchedules,
          createdSessions,
        );

        console.log(
          `✅ Session schedule mapping completed for classroom ${classroom.id}`,
        );
      } else {
        console.log(
          `⚠️ No session schedules found for course ${course.id} - skipping mapping`,
        );
      }
    } catch (error) {
      console.error('Failed to create classroom sessions:', error);
      // Don't fail the classroom creation if session generation fails
    }

    // Tự động tạo bài thi giữa kỳ và cuối kỳ
    try {
      const totalSessions = course.plannedSessions || 8; // Mặc định 8 buổi nếu không có thông tin

      await this.autoExamCreationService.createAutoExams({
        classroomId: classroom.id,
        courseId: course.id,
        teacherId: dto.teacherId,
        totalSessions: totalSessions,
        periodStart: periodStart,
        periodEnd: periodEnd,
        slots: dto.slots, // Truyền thông tin slots để tính thời gian
      });

      console.log(`🎯 Auto exams created for classroom ${classroom.id}`);
    } catch (error) {
      console.error('Failed to create auto exams:', error);
      // Don't fail the classroom creation if auto exam creation fails
    }

    return classroom;
  }

  async findById(id: string): Promise<Classroom> {
    const classroom = await this.classroomRepository.findById(id);
    if (!classroom) {
      throw new NotFoundException(`Classroom with id ${id} not found`);
    }
    return classroom;
  }

  async update(id: string, dto: UpdateClassroomDto): Promise<Classroom> {
    await this.findById(id);
    return this.classroomRepository.update(id, dto);
  }

  async delete(id: string): Promise<Classroom> {
    await this.findById(id);
    return this.classroomRepository.delete(id);
  }

  async list(
    params: FilterClassroomRequestDto,
    user?: JwtPayload,
  ): Promise<PageResponseDto<Classroom>> {
    // Auto-filter classrooms based on user role
    if (user && user.role === UserRole.teacher) {
      params.teacherId = user.sub;
    }

    return this.classroomRepository.list(params);
  }

  async addStudentToClassroom(
    classroomId: string,
    dto: AddStudentToClassroomDto,
  ): Promise<void> {
    const classroom = await this.findById(classroomId);
    const { studentIds } = dto;

    // Kiểm tra course có miễn phí không
    const course =
      await this.classroomRepository.getCourseByClassroomId(classroomId);
    const isPurchased = !course?.price || course.price <= 0;

    await this.classroomRepository.addStudents(
      classroomId,
      studentIds,
      isPurchased,
    );
  }

  async removeStudentFromClassroom(
    classroomId: string,
    studentId: string,
  ): Promise<void> {
    await this.classroomRepository.removeStudent(classroomId, studentId);
  }

  async assignTeacherToClassroom(
    classroomId: string,
    dto: AssignTeacherToClassroomDto,
  ): Promise<Classroom> {
    await this.findById(classroomId);
    // You might want to check if the teacher exists as well
    return this.classroomRepository.update(classroomId, {
      teacher: { connect: { id: dto.teacherId } },
    });
  }

  exportToCsv(params: FilterClassroomRequestDto, user?: JwtPayload): Readable {
    // Auto-filter classrooms based on user role
    if (user && user.role === UserRole.teacher) {
      params.teacherId = user.sub;
    }

    const dataStream = this.classroomRepository.streamAll(params);
    const csvTransform = getCsvTransformStream();
    return dataStream.pipe(csvTransform);
  }

  async myClassrooms(user: JwtPayload, status?: string) {
    const params: FilterClassroomRequestDto = {
      includePaymentStatus: true,
      page: 1,
      limit: 100, // Giới hạn đủ lớn để lấy tất cả các lớp học
    };

    if (user.role === UserRole.teacher) {
      params.teacherId = user.sub;
    } else if (user.role === UserRole.student) {
      params.studentId = user.sub;
    } else {
      return [];
    }

    if (
      status &&
      ['upcoming', 'ongoing', 'completed', 'cancelled'].includes(status)
    ) {
      params.status = status as any;
    }

    const result = await this.classroomRepository.list(params);
    return result.data;
  }

  async getClassroomAnnouncements(
    classroomId: string,
    user: JwtPayload,
    params: ClassroomAnnouncementQueryDto,
  ) {
    if (user.role === UserRole.teacher) {
      const allowed = await this.classroomRepository.isTeacherOfClassroom(
        classroomId,
        user.sub,
      );
      if (!allowed) {
        throw new ForbiddenException(
          'You do not have access to this classroom',
        );
      }
    } else if (user.role === UserRole.student) {
      const allowed = await this.classroomRepository.isStudentInClassroom(
        classroomId,
        user.sub,
      );
      if (!allowed) {
        throw new ForbiddenException(
          'You do not have access to this classroom',
        );
      }
    } else {
      throw new ForbiddenException('You do not have access to this classroom');
    }

    return this.classroomRepository.findAnnouncementsByClassroomId(
      classroomId,
      params,
    );
  }

  async createClassroomAnnouncement(
    classroomId: string,
    user: JwtPayload,
    payload: {
      title: string;
      content: string;
      priority?: string;
    },
  ) {
    if (user.role !== UserRole.teacher) {
      throw new ForbiddenException('Only teacher can create announcements');
    }

    const isTeacher = await this.classroomRepository.isTeacherOfClassroom(
      classroomId,
      user.sub,
    );
    if (!isTeacher) {
      throw new ForbiddenException('You do not manage this classroom');
    }

    return this.classroomRepository.createAnnouncement(classroomId, payload);
  }

  async getClassroomDetail(
    classroomId: string,
    userId?: string,
    userRole?: string,
  ) {
    if (userRole === 'student' && userId) {
      return this.classroomRepository.getClassroomDetailForStudent(
        classroomId,
        userId,
      );
    }
    return this.classroomRepository.getClassroomDetail(classroomId);
  }

  async importStudentsFromExcel(
    classroomId: string,
    file: Express.Multer.File,
  ): Promise<ImportStudentsResultDto> {
    // Verify classroom exists
    await this.findById(classroomId);

    // Parse Excel file
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

    const result: ImportStudentsResultDto = {
      totalProcessed: jsonData.length,
      successfullyImported: 0,
      failedImports: 0,
      errors: [],
      createdStudents: [],
      existingStudents: [],
    };

    const studentIdsToAdd: string[] = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2; // Excel rows start from 1, plus header row

      try {
        // Validate required fields
        const email = row['Email'] || row['email'];
        const phone = row['Phone'] || row['phone'];
        const firstName =
          row['First Name'] || row['firstName'] || row['FirstName'];
        const lastName = row['Last Name'] || row['lastName'] || row['LastName'];
        const displayName =
          row['Display Name'] ||
          row['displayName'] ||
          row['DisplayName'] ||
          `${firstName} ${lastName}`;
        const gender = row['Gender'] || row['gender'];

        if (!email || !phone || !firstName || !lastName) {
          result.errors.push({
            row: rowNumber,
            email: email || 'N/A',
            error:
              'Missing required fields: Email, Phone, First Name, Last Name',
          });
          result.failedImports++;
          continue;
        }

        // Check if student already exists by email
        const existingStudent =
          await this.classroomRepository.findStudentByEmail(email);

        if (existingStudent) {
          // Student exists, add to existing list
          result.existingStudents.push({
            id: existingStudent.id,
            email: existingStudent.email,
            firstName: existingStudent.firstName,
            lastName: existingStudent.lastName,
          });
          studentIdsToAdd.push(existingStudent.id);
        } else {
          // Create new student
          const passwordHash = await bcrypt.hash('TempPass123!', 10); // Default password

          const newStudent = await this.classroomRepository.createStudent({
            email,
            phone,
            firstName,
            lastName,
            displayName,
            gender:
              gender === 'male'
                ? 'male'
                : gender === 'female'
                  ? 'female'
                  : 'other',
            passwordHash,
            role: 'student',
            language: 'vi',
            timezone: 'Asia_Ho_Chi_Minh',
          });

          result.createdStudents.push({
            id: newStudent.id,
            email: newStudent.email,
            firstName: newStudent.firstName,
            lastName: newStudent.lastName,
          });
          studentIdsToAdd.push(newStudent.id);
        }

        result.successfullyImported++;
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          email: row['Email'] || row['email'] || 'N/A',
          error: error.message || 'Unknown error',
        });
        result.failedImports++;
      }
    }

    // Add all students to classroom
    if (studentIdsToAdd.length > 0) {
      // Kiểm tra course có miễn phí không
      const course =
        await this.classroomRepository.getCourseByClassroomId(classroomId);
      const isPurchased = !course?.price || course.price <= 0;

      await this.classroomRepository.addStudents(
        classroomId,
        studentIdsToAdd,
        isPurchased,
      );
    }

    return result;
  }

  async getTeacherSchedule(
    teacherId: string,
    weekStart?: string,
    weekEnd?: string,
    timezone: TimezoneCode = TimezoneCode.Asia_Ho_Chi_Minh,
    days: number = 7,
  ) {
    // Use same format as student schedule for consistency
    const query: StudentWeeklyScheduleQueryDto = {
      weekStart,
      timezone,
      days,
    };

    return this.buildTeacherWeeklySchedule(teacherId, query);
  }

  /**
   * Get system-wide schedule with optional filters
   * Used by CMS admins to view all schedules across the system
   */
  async getSystemSchedule(query: any) {
    const timezone = query.timezone ?? TimezoneCode.Asia_Ho_Chi_Minh;
    const referenceDate = query.weekStart
      ? new Date(query.weekStart)
      : new Date();
    const days = query.days ?? 7;

    const { startUtc, endUtc, weekStartLabel, weekEndLabel, dayLabels } =
      this.resolveWeekRange(referenceDate, timezone, days);

    // Build where clause with filters
    const whereClause: any = {
      startTime: {
        gte: startUtc,
        lt: endUtc,
      },
    };

    if (query.teacherId) {
      whereClause.instructorId = query.teacherId;
    }

    if (query.classroomId) {
      whereClause.classroomId = query.classroomId;
    }

    if (query.status) {
      whereClause.status = query.status;
    }

    // Get all sessions matching filters
    const sessions = await this.prisma.classroomSession.findMany({
      where: whereClause,
      include: {
        classroom: {
          select: {
            id: true,
            name: true,
            classCode: true,
            course: {
              select: {
                id: true,
                title: true,
                description: true,
                imageUrl: true,
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
            email: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    const now = new Date();

    const formattedSessions = sessions.map((session) => {
      const state = this.computeSessionState(
        session.startTime,
        session.endTime,
        now,
        session.status,
      );

      return {
        sessionId: session.id,
        classroomId: session.classroom.id,
        classroomName: session.classroom.name,
        classCode: session.classroom.classCode,
        title: session.title || session.classroom.name,
        description: session.description,
        status: session.status,
        type: session.type,
        startTime: session.startTime,
        endTime: session.endTime,
        timezone: session.timezone,
        durationHours: session.durationHours,
        meetingUrl: session.meetingUrl,
        notes: session.notes,
        course: session.classroom.course,
        instructor: session.instructor,
        state: state.state,
        stateLabel: state.label,
        startsInMinutes: state.startsInMinutes,
        endsInMinutes: state.endsInMinutes,
      };
    });

    // Group sessions by day (same as student schedule)
    const dayMap = new Map<string, any[]>();
    dayLabels.forEach((day) => {
      dayMap.set(day.key, []);
    });

    formattedSessions.forEach((session) => {
      const key = this.getDayKey(session.startTime, timezone);
      if (!dayMap.has(key)) {
        dayMap.set(key, []);
      }
      dayMap.get(key)?.push(session);
    });

    const daysArray = dayLabels.map((day) => {
      const sessionsForDay = (dayMap.get(day.key) ?? []).sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
      return {
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        label: day.label,
        sessions: sessionsForDay,
      };
    });

    // Calculate summary by state
    const summaryByState: Record<string, number> = {};
    formattedSessions.forEach((session) => {
      summaryByState[session.state] = (summaryByState[session.state] ?? 0) + 1;
    });

    return {
      timezone,
      weekStart: weekStartLabel,
      weekEnd: weekEndLabel,
      days: daysArray,
      summary: {
        totalSessions: formattedSessions.length,
        byState: summaryByState,
      },
      filters: {
        teacherId: query.teacherId,
        classroomId: query.classroomId,
        status: query.status,
      },
    };
  }

  /**
   * Get teacher recurring weekly availability (Mon-Sun with recurring time slots)
   * Used for classroom creation to show teacher's recurring schedule pattern
   * Returns slots from ALL active classrooms where teacher is assigned
   */
  async getTeacherWeeklyAvailability(
    teacherId: string,
    weekStart?: string,
    timezone: TimezoneCode = TimezoneCode.Asia_Ho_Chi_Minh,
  ) {
    const now = new Date();

    // Get all ACTIVE classrooms where this teacher is assigned
    const classrooms = await this.prisma.classroom.findMany({
      where: {
        teacherId,
        isActive: true,
        // Only classrooms that haven't ended yet
        periodStart: {
          gte: now,
        },
      },
      include: {
        slots: true,
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Group slots by day of week (mon, tue, wed, thu, fri, sat, sun)
    const weekSchedule: {
      [key: string]: Array<{
        classroomId: string;
        classroomName: string;
        courseTitle: string;
        startMinuteOfDay: number;
        endMinuteOfDay: number;
      }>;
    } = {
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    };

    const dayOfWeekMap = {
      MONDAY: 'mon',
      TUESDAY: 'tue',
      WEDNESDAY: 'wed',
      THURSDAY: 'thu',
      FRIDAY: 'fri',
      SATURDAY: 'sat',
      SUNDAY: 'sun',
    };

    // Collect all recurring slots from all active classrooms
    classrooms.forEach((classroom) => {
      classroom.slots.forEach((slot) => {
        console.log('slot', slot);
        weekSchedule[slot.dayOfWeek].push({
          classroomId: classroom.id,
          classroomName: classroom.name,
          courseTitle: classroom.course?.title || 'Unknown Course',
          startMinuteOfDay: slot.startMinuteOfDay,
          endMinuteOfDay: slot.endMinuteOfDay,
        });
      });
    });

    // Sort slots by start time for each day
    Object.keys(weekSchedule).forEach((dayKey) => {
      weekSchedule[dayKey].sort(
        (a, b) => a.startMinuteOfDay - b.startMinuteOfDay,
      );
    });

    return {
      teacherId,
      timezone,
      totalActiveClassrooms: classrooms.length,
      schedule: weekSchedule,
    };
  }

  private async buildTeacherWeeklySchedule(
    teacherId: string,
    query: StudentWeeklyScheduleQueryDto,
  ) {
    const timezone = query.timezone ?? TimezoneCode.Asia_Ho_Chi_Minh;
    const referenceDate = query.weekStart
      ? new Date(query.weekStart)
      : new Date();
    const days = query.days ?? 7;

    const { startUtc, endUtc, weekStartLabel, weekEndLabel, dayLabels } =
      this.resolveWeekRange(referenceDate, timezone, days);

    // Get all sessions for this teacher in the date range
    const sessions = await this.prisma.classroomSession.findMany({
      where: {
        instructorId: teacherId,
        startTime: {
          gte: startUtc,
          lt: endUtc,
        },
      },
      include: {
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
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    const now = new Date();

    const formattedSessions = sessions.map((session) => {
      const state = this.computeSessionState(
        session.startTime,
        session.endTime,
        now,
        session.status,
      );

      const instructor = session.instructor
        ? {
            id: session.instructor.id,
            displayName:
              session.instructor.displayName ||
              [session.instructor.firstName, session.instructor.lastName]
                .filter(Boolean)
                .join(' ')
                .trim(),
            avatarUrl: session.instructor.avatarUrl,
          }
        : null;

      const courseInfo = session.classroom.course
        ? {
            id: session.classroom.course.id,
            title: session.classroom.course.title,
            description: session.classroom.course.description,
          }
        : null;

      // Parse metadata for session schedule info and activities
      let sessionScheduleInfo = null;
      let activities = [];

      if (session.metadata && typeof session.metadata === 'object') {
        const metadata = session.metadata as any;
        if (metadata.courseSessionScheduleId) {
          sessionScheduleInfo = {
            courseSessionScheduleId: metadata.courseSessionScheduleId,
            sessionNumber: metadata.sessionNumber,
          };
        }
        if (metadata.activities && Array.isArray(metadata.activities)) {
          activities = metadata.activities.map((activity: any) => ({
            activityId: activity.activityId,
            orderNo: activity.orderNo,
            activity: {
              id: activity.activity?.id,
              title: activity.activity?.title,
              type: activity.activity?.type,
            },
          }));
        }
      }

      return {
        sessionId: session.id,
        classroomId: session.classroom.id,
        classroomName: session.classroom.name,
        title: session.title || session.classroom.name,
        description: session.description,
        status: session.status,
        type: session.type,
        startTime: session.startTime,
        endTime: session.endTime,
        timezone: session.timezone,
        durationHours: session.durationHours,
        meetingUrl: session.meetingUrl,
        agenda: session.agenda,
        materials: session.materials,
        instructor,
        state: state.state,
        stateLabel: state.label,
        startsInMinutes: state.startsInMinutes,
        endsInMinutes: state.endsInMinutes,
        course: courseInfo,
        sessionSchedule: sessionScheduleInfo,
        activities: activities,
      };
    });

    const summaryByState: Record<string, number> = {};
    formattedSessions.forEach((session) => {
      summaryByState[session.state] = (summaryByState[session.state] ?? 0) + 1;
    });

    const dayMap = new Map<string, any[]>();
    dayLabels.forEach((day) => {
      dayMap.set(day.key, []);
    });

    formattedSessions.forEach((session) => {
      const key = this.getDayKey(session.startTime, timezone);
      if (dayMap.has(key)) {
        dayMap.get(key)!.push(session);
      }
    });

    const daysArray = dayLabels.map((day) => ({
      date: day.date,
      dayOfWeek: day.key,
      label: day.label,
      sessions: dayMap.get(day.key) || [],
    }));

    return {
      teacherId,
      timezone,
      weekStart: weekStartLabel,
      weekEnd: weekEndLabel,
      days: daysArray,
      summary: {
        totalSessions: formattedSessions.length,
        byState: summaryByState,
      },
    };
  }

  async getMyDailySchedule(
    payload: JwtPayload,
    query: StudentDailyScheduleQueryDto,
  ) {
    // Support both students and teachers
    if (payload.role === UserRole.student) {
      return this.buildStudentDailySchedule(payload.sub, query);
    } else if (payload.role === UserRole.teacher) {
      // For teachers, use weekly schedule with 1 day
      const weeklyQuery: StudentWeeklyScheduleQueryDto = {
        weekStart: query.date,
        timezone: query.timezone,
        days: 1,
      };
      return this.buildTeacherWeeklySchedule(payload.sub, weeklyQuery);
    } else {
      throw new ForbiddenException(
        'Chỉ học sinh và giáo viên mới xem được thời khóa biểu cá nhân',
      );
    }
  }

  async getStudentDailyScheduleForRequester(
    payload: JwtPayload,
    studentId: string,
    query: StudentDailyScheduleQueryDto,
  ) {
    if (payload.role === UserRole.student) {
      if (payload.sub !== studentId) {
        throw new ForbiddenException(
          'Bạn chỉ được phép xem lịch học của bản thân',
        );
      }
    } else if (payload.role === UserRole.parent) {
      const allowed = await this.classroomRepository.isParentOfStudent(
        payload.sub,
        studentId,
      );
      if (!allowed) {
        throw new ForbiddenException(
          'Bạn không có quyền xem lịch học của học sinh này',
        );
      }
    } else if (payload.role === UserRole.teacher) {
      const allowed = await this.classroomRepository.isTeacherOfStudent(
        payload.sub,
        studentId,
      );
      if (!allowed) {
        throw new ForbiddenException('Bạn không giảng dạy học sinh này');
      }
    } else if (payload.role !== UserRole.admin) {
      throw new ForbiddenException('Bạn không có quyền xem lịch học này');
    }

    return this.buildStudentDailySchedule(studentId, query);
  }

  private async buildStudentDailySchedule(
    studentId: string,
    query: StudentDailyScheduleQueryDto,
  ) {
    const timezone = query.timezone ?? TimezoneCode.Asia_Ho_Chi_Minh;
    const referenceDate = query.date ? new Date(query.date) : new Date();

    const { startUtc, endUtc, localDateString } = this.resolveDayRange(
      referenceDate,
      timezone,
    );

    const sessions = await this.classroomRepository.getStudentDailySessions(
      studentId,
      startUtc,
      endUtc,
    );

    const now = new Date();

    const sortedSessions = [...sessions].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );

    const formattedSessions = sortedSessions.map((session) => {
      const state = this.computeSessionState(
        session.startTime,
        session.endTime,
        now,
        session.status,
      );

      const instructor = session.instructor
        ? {
            id: session.instructor.id,
            displayName:
              session.instructor.displayName ||
              [session.instructor.firstName, session.instructor.lastName]
                .filter(Boolean)
                .join(' ')
                .trim(),
            avatarUrl: session.instructor.avatarUrl,
          }
        : null;

      return {
        sessionId: session.id,
        classroomId: session.classroom.id,
        classroomName: session.classroom.name,
        title: session.title || session.classroom.name,
        description: session.description,
        status: session.status,
        type: session.type,
        startTime: session.startTime,
        endTime: session.endTime,
        timezone: session.timezone,
        durationHours: session.durationHours,
        meetingUrl: session.meetingUrl,
        agenda: session.agenda,
        materials: session.materials,
        instructor,
        attendanceStatus: session.attendance?.[0]?.status ?? null,
        state: state.state,
        stateLabel: state.label,
        startsInMinutes: state.startsInMinutes,
        endsInMinutes: state.endsInMinutes,
      };
    });

    const total = formattedSessions.length;
    let upcoming = 0;
    let ongoing = 0;
    let completed = 0;

    formattedSessions.forEach((session) => {
      if (session.state === 'upcoming') {
        upcoming++;
      } else if (session.state === 'ongoing') {
        ongoing++;
      } else if (session.state === 'completed') {
        completed++;
      }
    });

    const firstSessionStart = formattedSessions[0]?.startTime ?? null;
    const lastSessionEnd =
      formattedSessions[formattedSessions.length - 1]?.endTime ?? null;

    const hasConflicts = formattedSessions.some((session, index) => {
      if (index === 0) {
        return false;
      }
      const previous = formattedSessions[index - 1];
      return (
        new Date(session.startTime).getTime() <
        new Date(previous.endTime).getTime()
      );
    });

    return {
      studentId,
      timezone,
      date: localDateString,
      range: {
        startUtc: startUtc.toISOString(),
        endUtc: endUtc.toISOString(),
      },
      sessions: formattedSessions,
      summary: {
        total,
        upcoming,
        ongoing,
        completed,
        firstSessionStart,
        lastSessionEnd,
        hasConflicts,
      },
    };
  }

  async getMyWeeklySchedule(
    payload: JwtPayload,
    query: StudentWeeklyScheduleQueryDto,
  ) {
    // Support both students and teachers
    if (payload.role === UserRole.student) {
      return this.buildStudentWeeklySchedule(payload.sub, query);
    } else if (payload.role === UserRole.teacher) {
      return this.buildTeacherWeeklySchedule(payload.sub, query);
    } else {
      throw new ForbiddenException(
        'Chỉ học sinh và giáo viên mới xem được thời khóa biểu tuần của mình',
      );
    }
  }

  async getStudentWeeklyScheduleForRequester(
    payload: JwtPayload,
    studentId: string,
    query: StudentWeeklyScheduleQueryDto,
  ) {
    if (payload.role === UserRole.student) {
      if (payload.sub !== studentId) {
        throw new ForbiddenException(
          'Bạn chỉ được phép xem lịch học của bản thân',
        );
      }
    } else if (payload.role === UserRole.parent) {
      const allowed = await this.classroomRepository.isParentOfStudent(
        payload.sub,
        studentId,
      );
      if (!allowed) {
        throw new ForbiddenException(
          'Bạn không có quyền xem lịch học của học sinh này',
        );
      }
    } else if (payload.role === UserRole.teacher) {
      const allowed = await this.classroomRepository.isTeacherOfStudent(
        payload.sub,
        studentId,
      );
      if (!allowed) {
        throw new ForbiddenException('Bạn không giảng dạy học sinh này');
      }
    } else if (payload.role !== UserRole.admin) {
      throw new ForbiddenException('Bạn không có quyền xem lịch học này');
    }

    return this.buildStudentWeeklySchedule(studentId, query);
  }

  private async buildStudentWeeklySchedule(
    studentId: string,
    query: StudentWeeklyScheduleQueryDto,
  ) {
    const timezone = query.timezone ?? TimezoneCode.Asia_Ho_Chi_Minh;
    const referenceDate = query.weekStart
      ? new Date(query.weekStart)
      : new Date();
    const days = query.days ?? 7;

    console.log('📅 Weekly Schedule Debug:');
    console.log(`   Query weekStart: ${query.weekStart}`);
    console.log(`   Reference date: ${referenceDate.toISOString()}`);
    console.log(
      `   Reference day of week: ${referenceDate.getUTCDay()} (0=Sunday, 1=Monday, etc.)`,
    );
    console.log(`   Timezone: ${timezone}`);
    console.log(`   Today is: ${new Date().toISOString()}`);

    // Debug the specific calculation
    const debugDate = new Date('2025-09-28T17:00:00.000Z');
    console.log(`   🧮 Debug calculation for 2025-09-28:`);
    console.log(`      Input date: ${debugDate.toISOString()}`);
    console.log(
      `      Day of week: ${debugDate.getUTCDay()} (should be 0=Sunday)`,
    );

    const dayOfWeek = debugDate.getUTCDay();
    const daysToGoBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    console.log(
      `      Days to go back: ${daysToGoBack} (should be 6 for Sunday)`,
    );

    const mondayDate = new Date(debugDate);
    mondayDate.setUTCDate(mondayDate.getUTCDate() - daysToGoBack);
    console.log(`      Monday should be: ${mondayDate.toISOString()}`);
    console.log(`      Expected Monday: 2025-09-22 (if 28th is Sunday)`);

    const { startUtc, endUtc, weekStartLabel, weekEndLabel, dayLabels } =
      this.resolveWeekRange(referenceDate, timezone, days);

    console.log(`   Calculated startUtc: ${startUtc.toISOString()}`);
    console.log(`   Calculated endUtc: ${endUtc.toISOString()}`);
    console.log(`   Week range: ${weekStartLabel} - ${weekEndLabel}`);
    console.log(
      `   🤔 Issue: If we want current week (Sept 30 - Oct 6), need different logic`,
    );

    const sessions = await this.classroomRepository.getStudentWeeklySessions(
      studentId,
      startUtc,
      endUtc,
    );

    const now = new Date();

    const formattedSessions = sessions.map((session) => {
      const state = this.computeSessionState(
        session.startTime,
        session.endTime,
        now,
        session.status,
      );

      const instructor = session.instructor
        ? {
            id: session.instructor.id,
            displayName:
              session.instructor.displayName ||
              [session.instructor.firstName, session.instructor.lastName]
                .filter(Boolean)
                .join(' ')
                .trim(),
            avatarUrl: session.instructor.avatarUrl,
          }
        : null;

      // Extract course và lesson info từ metadata và classroom
      const courseInfo = session.classroom.course
        ? {
            id: session.classroom.course.id,
            title: session.classroom.course.title,
            description: session.classroom.course.description,
          }
        : null;

      // Parse metadata để lấy session schedule info và activities (giáo trình)
      let sessionScheduleInfo = null;
      let activities = [];

      // Debug metadata
      if (
        session.id === '7b871ee2-c2a3-4d41-8cb3-b0cf99f9f6de' ||
        session.id === 'cfd221d8-cad3-4593-9632-25dc9e1ac678'
      ) {
        console.log(`🔍 Session ${session.id} metadata debug:`);
        console.log(`   Metadata: ${JSON.stringify(session.metadata)}`);
        console.log(`   Classroom: ${session.classroom?.id}`);
      }

      if (session.metadata && typeof session.metadata === 'object') {
        const metadata = session.metadata as any;
        if (metadata.courseSessionScheduleId) {
          sessionScheduleInfo = {
            courseSessionScheduleId: metadata.courseSessionScheduleId,
            sessionNumber: metadata.sessionNumber,
          };
        }
        if (metadata.activities && Array.isArray(metadata.activities)) {
          activities = metadata.activities.map((activity: any) => ({
            activityId: activity.activityId,
            orderNo: activity.orderNo,
            activity: {
              id: activity.activity?.id,
              title: activity.activity?.title,
              type: activity.activity?.type,
            },
          }));
        }
      }

      return {
        sessionId: session.id,
        classroomId: session.classroom.id,
        classroomName: session.classroom.name,
        title: session.title || session.classroom.name,
        description: session.description,
        status: session.status,
        type: session.type,
        startTime: session.startTime,
        endTime: session.endTime,
        timezone: session.timezone,
        durationHours: session.durationHours,
        meetingUrl: session.meetingUrl,
        agenda: session.agenda,
        materials: session.materials,
        instructor,
        attendanceStatus: session.attendance?.[0]?.status ?? null,
        state: state.state,
        stateLabel: state.label,
        startsInMinutes: state.startsInMinutes,
        endsInMinutes: state.endsInMinutes,
        // Thêm thông tin course và giáo trình cho từng buổi học
        course: courseInfo,
        sessionSchedule: sessionScheduleInfo,
        activities: activities,
      };
    });

    const summaryByState: Record<string, number> = {};
    formattedSessions.forEach((session) => {
      summaryByState[session.state] = (summaryByState[session.state] ?? 0) + 1;
    });

    const dayMap = new Map<string, any[]>();
    dayLabels.forEach((day) => {
      dayMap.set(day.key, []);
    });

    formattedSessions.forEach((session) => {
      const key = this.getDayKey(session.startTime, timezone);
      if (!dayMap.has(key)) {
        dayMap.set(key, []);
      }
      dayMap.get(key)?.push(session);
    });

    const daysResult = dayLabels.map((day) => {
      const sessionsForDay = (dayMap.get(day.key) ?? []).sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
      return {
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        label: day.label,
        sessions: sessionsForDay,
      };
    });

    return {
      studentId,
      timezone,
      weekStart: weekStartLabel,
      weekEnd: weekEndLabel,
      days: daysResult,
      summary: {
        totalSessions: formattedSessions.length,
        byState: summaryByState,
      },
    };
  }

  private resolveDayRange(referenceDate: Date, timezone: TimezoneCode) {
    const parts = this.getDatePartsInTimezone(referenceDate, timezone);
    const offsetMinutes = TIMEZONE_OFFSETS[timezone] ?? 0;
    const startUtc = new Date(
      Date.UTC(parts.year, parts.month, parts.day, 0, 0, 0, 0),
    );
    startUtc.setUTCMinutes(startUtc.getUTCMinutes() - offsetMinutes);
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

    const localDateString = `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;

    return {
      startUtc,
      endUtc,
      localDateString,
    };
  }

  private getDatePartsInTimezone(date: Date, timezone: TimezoneCode) {
    const tz = timezone.replace('_', '/');
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const yearPart = parts.find((p) => p.type === 'year');
    const monthPart = parts.find((p) => p.type === 'month');
    const dayPart = parts.find((p) => p.type === 'day');

    const year = yearPart ? Number(yearPart.value) : date.getUTCFullYear();
    const month = monthPart ? Number(monthPart.value) - 1 : date.getUTCMonth();
    const day = dayPart ? Number(dayPart.value) : date.getUTCDate();

    return { year, month, day };
  }

  private computeSessionState(
    start: Date,
    end: Date,
    now: Date,
    status: SessionStatus,
  ) {
    const startMs = start.getTime();
    const endMs = end.getTime();
    const nowMs = now.getTime();

    const diffStart = startMs - nowMs;
    const diffEnd = endMs - nowMs;

    const minutes = (value: number) => Math.max(0, Math.round(value / 60000));

    if (status === SessionStatus.cancelled) {
      return {
        state: 'cancelled',
        label: 'Đã hủy',
        startsInMinutes: null,
        endsInMinutes: null,
      };
    }

    if (status === SessionStatus.postponed) {
      return {
        state: 'postponed',
        label: 'Hoãn lại',
        startsInMinutes: diffStart > 0 ? minutes(diffStart) : null,
        endsInMinutes: null,
      };
    }

    if (status === SessionStatus.completed || nowMs >= endMs) {
      return {
        state: 'completed',
        label: 'Đã kết thúc',
        startsInMinutes: null,
        endsInMinutes: null,
      };
    }

    if (
      status === SessionStatus.ongoing ||
      (nowMs >= startMs && nowMs < endMs)
    ) {
      return {
        state: 'ongoing',
        label: 'Đang diễn ra',
        startsInMinutes: null,
        endsInMinutes: minutes(diffEnd),
      };
    }

    return {
      state: 'upcoming',
      label: 'Sắp diễn ra',
      startsInMinutes: minutes(diffStart),
      endsInMinutes: null,
    };
  }

  private getDayOfWeek(date: Date): string {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return days[date.getDay()];
  }

  private formatDayOfWeekLabel(dayOfWeek: string): string {
    const labels: Record<string, string> = {
      mon: 'Thứ Hai',
      tue: 'Thứ Ba',
      wed: 'Thứ Tư',
      thu: 'Thứ Năm',
      fri: 'Thứ Sáu',
      sat: 'Thứ Bảy',
      sun: 'Chủ Nhật',
    };
    return labels[dayOfWeek] || dayOfWeek;
  }

  private getDayKey(date: Date, timezone: TimezoneCode): string {
    const parts = this.getDatePartsInTimezone(date, timezone);
    return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  private resolveWeekRange(
    referenceDate: Date,
    timezone: TimezoneCode,
    days: number,
  ) {
    const startOfWeek = new Date(referenceDate);
    const dayOfWeek = startOfWeek.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

    console.log('🔧 FIXED: resolveWeekRange logic');
    console.log(`   Input date: ${referenceDate.toISOString()}`);
    console.log(`   Day of week: ${dayOfWeek} (0=Sun, 1=Mon)`);

    // FIXED LOGIC: If Sunday, treat it as start of NEW week (go forward to Monday)
    // If other days, go back to Monday of same week
    let daysToGoBack;
    if (dayOfWeek === 0) {
      // Sunday: go forward 1 day to get Monday of NEXT week
      daysToGoBack = -1; // Negative means go forward
      console.log('   Sunday detected: treating as start of NEW week');
    } else {
      // Other days: go back to Monday of same week
      daysToGoBack = dayOfWeek - 1;
      console.log('   Other day: going back to Monday of same week');
    }

    console.log(`   Days adjustment: ${daysToGoBack} (negative = forward)`);

    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - daysToGoBack);
    startOfWeek.setUTCHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + days - 1);
    endOfWeek.setUTCHours(23, 59, 59, 999);

    console.log(`   Final Monday: ${startOfWeek.toISOString()}`);
    console.log(`   Final Sunday: ${endOfWeek.toISOString()}`);

    const weekStartLabel = this.formatDateInTimezone(startOfWeek, timezone);
    const weekEndLabel = this.formatDateInTimezone(endOfWeek, timezone);

    console.log(`   Week range: ${weekStartLabel} - ${weekEndLabel}`);
    console.log(`   ✅ For 2025-09-28 (Sun) should now return: 29/09 - 05/10`);

    const dayLabels = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startOfWeek);
      date.setUTCDate(startOfWeek.getUTCDate() + i);
      const dayOfWeek = this.getDayOfWeek(date);
      const label = this.formatDateInTimezone(date, timezone);
      dayLabels.push({
        key: this.getDayKey(date, timezone),
        date,
        dayOfWeek,
        label,
      });
    }

    return {
      startUtc: startOfWeek,
      endUtc: endOfWeek,
      weekStartLabel,
      weekEndLabel,
      dayLabels,
    };
  }

  async getParentChildrenWeeklySchedule(
    parentId: string,
    weekStart?: string,
    weekEnd?: string,
    timezone: string = 'Asia_Ho_Chi_Minh',
    days: number = 7,
  ) {
    // Get all children of this parent via ParentChild relationship
    const parentChildRelations = await this.prisma.parentChild.findMany({
      where: { parentId },
      include: {
        child: {
          select: {
            id: true,
            displayName: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!parentChildRelations || parentChildRelations.length === 0) {
      return {
        parentId,
        children: [],
        timezone,
        weekStart: weekStart || new Date().toISOString(),
        weekEnd: weekEnd || new Date().toISOString(),
        combinedSchedule: {
          days: [],
          summary: {
            totalSessions: 0,
            byState: {},
          },
        },
      };
    }

    // Build query for weekly schedule
    const query: StudentWeeklyScheduleQueryDto = {
      weekStart,
      timezone: timezone as TimezoneCode,
      days,
    };

    // Get schedule for each child
    const childrenSchedules = await Promise.all(
      parentChildRelations.map(async (relation) => {
        const child = relation.child;
        const schedule = await this.buildStudentWeeklySchedule(child.id, query);
        return {
          childId: child.id,
          childName:
            child.displayName || `${child.firstName} ${child.lastName}`.trim(),
          childEmail: child.email,
          schedule,
        };
      }),
    );

    // Combine all sessions from all children
    const allDays = childrenSchedules[0]?.schedule.days || [];
    const combinedDays = allDays.map((day, dayIndex) => {
      const allSessionsForDay = childrenSchedules.flatMap((childSchedule) => {
        const childDay = childSchedule.schedule.days[dayIndex];
        return (childDay?.sessions || []).map((session) => ({
          ...session,
          childId: childSchedule.childId,
          childName: childSchedule.childName,
        }));
      });

      // Sort sessions by start time
      allSessionsForDay.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

      return {
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        label: day.label,
        sessions: allSessionsForDay,
      };
    });

    // Calculate combined summary
    const summaryByState: Record<string, number> = {};
    const totalSessions = combinedDays.reduce((sum, day) => {
      day.sessions.forEach((session) => {
        summaryByState[session.state] =
          (summaryByState[session.state] ?? 0) + 1;
      });
      return sum + day.sessions.length;
    }, 0);

    return {
      parentId,
      children: parentChildRelations.map((relation) => ({
        id: relation.child.id,
        displayName: relation.child.displayName,
        email: relation.child.email,
        firstName: relation.child.firstName,
        lastName: relation.child.lastName,
      })),
      timezone,
      weekStart: childrenSchedules[0]?.schedule.weekStart,
      weekEnd: childrenSchedules[0]?.schedule.weekEnd,
      combinedSchedule: {
        days: combinedDays,
        summary: {
          totalSessions,
          byState: summaryByState,
        },
      },
      childrenSchedules: childrenSchedules.map((cs) => ({
        childId: cs.childId,
        childName: cs.childName,
        childEmail: cs.childEmail,
        totalSessions: cs.schedule.summary.totalSessions,
        byState: cs.schedule.summary.byState,
      })),
    };
  }

  private formatDateInTimezone(date: Date, timezone: TimezoneCode): string {
    // Convert timezone from enum format (Asia_Ho_Chi_Minh) to IANA format (Asia/Ho_Chi_Minh)
    // Only replace the FIRST underscore: Asia_Ho_Chi_Minh → Asia/Ho_Chi_Minh
    const ianaTimezone = timezone.replace('_', '/');

    const options: Intl.DateTimeFormatOptions = {
      timeZone: ianaTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    return new Intl.DateTimeFormat('en-GB', options).format(date);
  }

  /**
   * Map course session schedules to classroom sessions
   */
  private async mapCourseSessionSchedulesToClassroom(
    classroomId: string,
    courseSessionSchedules: any[],
    classroomSessions: any[],
  ): Promise<void> {
    try {
      console.log(`🎯 Starting session mapping for classroom ${classroomId}`);
      console.log(
        `   Course session schedules: ${courseSessionSchedules.length}`,
      );
      console.log(`   Classroom sessions: ${classroomSessions.length}`);

      // Sort classroom sessions by start time to match them with course session schedules
      const sortedClassroomSessions = classroomSessions.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

      for (
        let i = 0;
        i < courseSessionSchedules.length && i < sortedClassroomSessions.length;
        i++
      ) {
        const courseSessionSchedule = courseSessionSchedules[i];
        const classroomSession = sortedClassroomSessions[i];

        console.log(
          `🔗 Mapping session ${i + 1}: ${courseSessionSchedule.title} → ${classroomSession.id}`,
        );
        console.log(
          `   Activities: ${courseSessionSchedule.activities?.length || 0}`,
        );

        // Update classroom session with course session schedule info
        await this.classroomRepository.updateSession(classroomSession.id, {
          title:
            courseSessionSchedule.title ||
            `Session ${courseSessionSchedule.sessionNumber}`,
          description: courseSessionSchedule.description,
          // Store the session schedule activities as metadata
          metadata: {
            courseSessionScheduleId: courseSessionSchedule.id,
            sessionNumber: courseSessionSchedule.sessionNumber,
            activities:
              courseSessionSchedule.activities?.map((sa: any) => ({
                activityId: sa.activityId,
                orderNo: sa.orderNo,
                activity: {
                  id: sa.activity.id,
                  title: sa.activity.title,
                  type: sa.activity.type,
                },
              })) || [],
          },
        });

        console.log(`✅ Updated session ${classroomSession.id} with metadata`);
      }

      console.log(
        `🎉 Session mapping completed successfully for ${courseSessionSchedules.length} sessions`,
      );
    } catch (error) {
      console.error(
        '❌ Failed to map course session schedules to classroom:',
        error,
      );
      console.error('Error details:', error.stack);
      // Don't throw error to avoid breaking classroom creation
    }
  }

  /**
   * Update classroom status manually by Admin/Teacher
   * Validates status transition rules
   */
  async updateClassroomStatus(
    classroomId: string,
    newStatus: ClassroomStatus,
    adminUserId: string,
  ): Promise<Classroom> {
    // Find classroom
    const classroom = await this.classroomRepository.findById(classroomId);
    if (!classroom) {
      throw new NotFoundException(`Classroom with id ${classroomId} not found`);
    }

    // Validate status transition
    const currentStatus = classroom.status;

    // Business rules for status transitions
    if (currentStatus === ClassroomStatus.cancelled) {
      throw new ForbiddenException(
        'Cannot change status of a cancelled classroom',
      );
    }

    if (
      currentStatus === ClassroomStatus.completed &&
      newStatus !== ClassroomStatus.cancelled
    ) {
      throw new ForbiddenException(
        'Can only cancel a completed classroom, cannot reactivate',
      );
    }

    // Update status
    const updatedClassroom = await this.prisma.classroom.update({
      where: { id: classroomId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
      include: {
        course: true,
        teacher: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        students: {
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
        },
      },
    });

    console.log(
      `✅ Classroom ${classroomId} status updated: ${currentStatus} → ${newStatus} by ${adminUserId}`,
    );

    // TODO: Optional - Send notification to students/teacher about status change
    // await this.notificationService.notifyClassroomStatusChange(classroomId, currentStatus, newStatus);

    return updatedClassroom;
  }

  /**
   * Auto-update classroom statuses based on dates
   * Should be called by cron job
   */
  async autoUpdateClassroomStatuses(): Promise<{
    activatedCount: number;
    completedCount: number;
  }> {
    const now = new Date();

    // Update UPCOMING → ONGOING for classrooms that started
    const activatedResult = await this.prisma.classroom.updateMany({
      where: {
        status: ClassroomStatus.upcoming,
        periodStart: { lte: now },
        periodEnd: { gt: now },
      },
      data: {
        status: ClassroomStatus.ongoing,
        updatedAt: now,
      },
    });

    // Update ONGOING → COMPLETED for classrooms that ended
    const completedResult = await this.prisma.classroom.updateMany({
      where: {
        status: ClassroomStatus.ongoing,
        periodEnd: { lte: now },
      },
      data: {
        status: ClassroomStatus.completed,
        updatedAt: now,
      },
    });

    console.log(
      `🔄 Auto-updated classroom statuses: ${activatedResult.count} activated, ${completedResult.count} completed`,
    );

    return {
      activatedCount: activatedResult.count,
      completedCount: completedResult.count,
    };
  }

  /**
   * Transfer student from one classroom to another
   * @param studentId ID của học sinh
   * @param currentClassroomId ID của lớp hiện tại
   * @param newClassroomId ID của lớp mới
   * @param adminUserId ID của admin/teacher thực hiện chuyển lớp
   */
  async transferStudent(
    studentId: string,
    currentClassroomId: string,
    newClassroomId: string,
    adminUserId: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    // 1. Validate input
    if (currentClassroomId === newClassroomId) {
      throw new ForbiddenException(
        'Cannot transfer student to the same classroom',
      );
    }

    // 2. Check student exists
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, email: true, displayName: true, role: true },
    });

    if (!student) {
      throw new NotFoundException(`Student with id ${studentId} not found`);
    }

    if (student.role !== UserRole.student) {
      throw new ForbiddenException('User is not a student');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 3. Check current classroom và student có trong lớp không
      const currentClassroom = await tx.classroom.findUnique({
        where: { id: currentClassroomId },
        include: {
          students: {
            where: { studentId },
          },
        },
      });

      if (!currentClassroom) {
        throw new NotFoundException(
          `Current classroom with id ${currentClassroomId} not found`,
        );
      }

      const studentInCurrentClass = currentClassroom.students.length > 0;
      if (!studentInCurrentClass) {
        throw new ForbiddenException(
          `Student ${studentId} is not in classroom ${currentClassroomId}`,
        );
      }

      // 4. Check new classroom
      const newClassroom = await tx.classroom.findUnique({
        where: { id: newClassroomId },
        include: {
          students: {
            where: { isActive: true },
          },
        },
      });

      if (!newClassroom) {
        throw new NotFoundException(
          `New classroom with id ${newClassroomId} not found`,
        );
      }

      // 5. Check student đã có trong new classroom chưa
      const studentAlreadyInNewClass = await tx.classroomStudent.findFirst({
        where: {
          classroomId: newClassroomId,
          studentId,
        },
      });

      if (studentAlreadyInNewClass) {
        throw new ForbiddenException(
          `Student is already in classroom ${newClassroomId}`,
        );
      }

      // 6. Check new classroom còn chỗ không
      if (newClassroom.maxStudents) {
        const activeStudentsCount = newClassroom.students.length;
        if (activeStudentsCount >= newClassroom.maxStudents) {
          throw new ForbiddenException(
            `New classroom is full (${activeStudentsCount}/${newClassroom.maxStudents})`,
          );
        }
      }

      // 7. Remove student from current classroom
      await tx.classroomStudent.delete({
        where: {
          classroomId_studentId: {
            classroomId: currentClassroomId,
            studentId,
          },
        },
      });

      // 8. Add student to new classroom
      await tx.classroomStudent.create({
        data: {
          classroomId: newClassroomId,
          studentId,
          isActive: true,
        },
      });

      console.log(
        `✅ Student ${studentId} transferred from classroom ${currentClassroomId} to ${newClassroomId} by ${adminUserId}`,
      );

      // TODO: Optional - Gửi notification cho học sinh về việc chuyển lớp
      // TODO: Optional - Log action vào audit log

      return {
        success: true,
        message: `Student successfully transferred from ${currentClassroom.name} to ${newClassroom.name}`,
      };
    });
  }
}
