import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Classroom, Prisma } from '@prisma/client';
import { Readable } from 'stream';
import {
  ClassroomAnnouncementQueryDto,
  FilterClassroomRequestDto,
} from '../dto/classroom.dto';

@Injectable()
export class ClassroomRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async create(data: Prisma.ClassroomCreateInput): Promise<Classroom> {
    return this.prisma.classroom.create({ data });
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
    } = params;

    const where: Prisma.ClassroomWhereInput = {
      teacherId,
      name: search ? { contains: search, mode: 'insensitive' } : undefined,
    };

    const totalItems = await this.prisma.classroom.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const data = await this.prisma.classroom.findMany({
      where,
      skip: (safePage - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { students: true, teacher: true },
    });

    return PageResponseDto.of(data, safePage, limit, totalItems);
  }

  async addStudents(classroomId: string, studentIds: string[]) {
    const data = studentIds.map((studentId) => ({ classroomId, studentId }));
    return this.prisma.classroomStudent.createMany({
      data,
      skipDuplicates: true,
    });
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
      createdAt: a.createdAt,
      _count: { submissions: a.submissions.length },
      activities:
        a.assignmentActivities?.map((activity) => ({
          id: activity.id,
          type: activity.type,
          title: activity.title,
          instructions: activity.instructions,
          content: activity.content,
          points: activity.points,
          timeLimit: activity.timeLimit,
          maxAttempts: activity.maxAttempts,
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
          duration: act.timeLimit,
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

    // Schedule
    const schedule =
      classroom.slots && classroom.slots.length > 0
        ? {
            days: classroom.slots.map((s) => s.dayOfWeek),
            time:
              classroom.slots[0].startMinuteOfDay !== undefined
                ? `${Math.floor(classroom.slots[0].startMinuteOfDay / 60)}:${String(classroom.slots[0].startMinuteOfDay % 60).padStart(2, '0')}`
                : undefined,
            duration:
              classroom.slots[0].sessionDurationHours !== undefined
                ? Math.round(classroom.slots[0].sessionDurationHours * 60)
                : undefined,
          }
        : undefined;

    return {
      id: classroom.id,
      name: classroom.name,
      description: classroom.description,
      classCode: classroom.classCode,
      teacher: classroom.teacher,
      isActive: classroom.isActive,
      maxStudents: classroom.maxStudents,
      createdAt: classroom.createdAt,
      updatedAt: classroom.updatedAt,
      expiresAt: classroom.expiresAt,
      settings,
      schedule,
      _count,
      students,
      assignments,
      announcements,
      lessons,
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
}
