import { JwtPayload } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Classroom,
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
  ) {}

  async create(dto: CreateClassroomDto): Promise<Classroom> {
    // Calculate planned sessions and hours from period and slots
    const scheduleCalculation = calculateClassroomSchedule(
      dto.periodStart,
      dto.periodEnd,
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
      isActive: dto.isActive || true,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
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
    } catch (error) {
      console.error('Failed to create classroom sessions:', error);
      // Don't fail the classroom creation if session generation fails
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
  ): Promise<PageResponseDto<Classroom>> {
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

  exportToCsv(params: FilterClassroomRequestDto): Readable {
    const dataStream = this.classroomRepository.streamAll(params);
    const csvTransform = getCsvTransformStream();
    return dataStream.pipe(csvTransform);
  }

  async myClassrooms(user: JwtPayload, status?: string) {
    const params: FilterClassroomRequestDto = {
      includePaymentStatus: true,
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
      await this.classroomRepository.addStudents(classroomId, studentIdsToAdd);
    }

    return result;
  }

  async getTeacherSchedule(
    teacherId: string,
    weekStart?: string,
    weekEnd?: string,
  ) {
    const startDate = weekStart ? new Date(weekStart) : new Date();
    const endDate = weekEnd
      ? new Date(weekEnd)
      : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const scheduleData = await this.classroomRepository.getTeacherSchedule(
      teacherId,
      startDate,
      endDate,
    );

    // Process and format the schedule data
    const schedule: { [dayOfWeek: string]: any[] } = {
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    };

    // Add classroom slots (recurring weekly schedule)
    scheduleData.classroomSlots.forEach((slot) => {
      const classroom = slot.classroom;
      const now = new Date();

      // Check if classroom is currently active
      const isActive =
        classroom.periodStart <= now && classroom.periodEnd >= now;

      if (isActive) {
        schedule[slot.dayOfWeek].push({
          type: 'classroom_slot',
          dayOfWeek: slot.dayOfWeek,
          startMinuteOfDay: slot.startMinuteOfDay,
          endMinuteOfDay: slot.endMinuteOfDay,
          classroomId: classroom.id,
          classroomName: classroom.name,
          status: 'occupied',
        });
      }
    });

    // Add actual sessions
    scheduleData.sessions.forEach((session) => {
      const dayOfWeek = this.getDayOfWeek(session.startTime);
      const startMinute =
        session.startTime.getHours() * 60 + session.startTime.getMinutes();
      const endMinute =
        session.endTime.getHours() * 60 + session.endTime.getMinutes();

      schedule[dayOfWeek].push({
        type: 'session',
        dayOfWeek,
        startMinuteOfDay: startMinute,
        endMinuteOfDay: endMinute,
        classroomId: session.classroom.id,
        classroomName: session.classroom.name,
        status: 'occupied',
        sessionId: session.id,
        sessionTitle: session.title,
        sessionStatus: session.status,
      });
    });

    // Sort each day's schedule by start time
    Object.keys(schedule).forEach((day) => {
      schedule[day].sort((a, b) => a.startMinuteOfDay - b.startMinuteOfDay);
    });

    return {
      teacherId: scheduleData.teacherId,
      weekStart: scheduleData.weekStart,
      weekEnd: scheduleData.weekEnd,
      schedule,
    };
  }

  async getMyDailySchedule(
    payload: JwtPayload,
    query: StudentDailyScheduleQueryDto,
  ) {
    if (payload.role !== UserRole.student) {
      throw new ForbiddenException(
        'Chỉ học sinh mới xem được thời khóa biểu cá nhân',
      );
    }

    return this.buildStudentDailySchedule(payload.sub, query);
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
    if (payload.role !== UserRole.student) {
      throw new ForbiddenException(
        'Chỉ học sinh mới xem được thời khóa biểu tuần của mình',
      );
    }

    return this.buildStudentWeeklySchedule(payload.sub, query);
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

    const { startUtc, endUtc, weekStartLabel, weekEndLabel, dayLabels } =
      this.resolveWeekRange(referenceDate, timezone, days);

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
    const dayOfWeek = startOfWeek.getUTCDay();
    const diff = (dayOfWeek + 6) % 7; // Difference in days to last Monday
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - diff);
    startOfWeek.setUTCHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + days - 1);
    endOfWeek.setUTCHours(23, 59, 59, 999);

    const weekStartLabel = this.formatDateInTimezone(startOfWeek, timezone);
    const weekEndLabel = this.formatDateInTimezone(endOfWeek, timezone);

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

  private formatDateInTimezone(date: Date, timezone: TimezoneCode): string {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone.replace('_', '/'),
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
}
