import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Course, Prisma, UserRole } from '@prisma/client';
import {
  CreateCourseDto,
  FilterCourseRequestDto,
  UpdateCourseDto,
} from '../dto/course.dto';
import { CourseRepository } from '../repository/course.repository';

function normalizeCurrency(code?: string): string | undefined {
  if (!code) return undefined;
  return code.trim().toUpperCase();
}

@Injectable()
export class CourseService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly prisma: PrismaRepository,
  ) {}

  async create(dto: CreateCourseDto): Promise<Course> {
    // Validate instructor
    const instructor = await this.prisma.user.findUnique({
      where: { id: dto.instructorId },
    });
    if (!instructor) throw new BadRequestException('Instructor không tồn tại');
    if (instructor.role !== UserRole.teacher) {
      throw new BadRequestException('Instructor phải có vai trò TEACHER');
    }
    if (dto.price != null && dto.price < 0) {
      throw new BadRequestException('Giá không được âm');
    }

    // Optional check: orderNo unique (business rule)
    if (dto.orderNo != null) {
      const sameOrder = await this.prisma.course.findFirst({
        where: { orderNo: dto.orderNo },
      });
      if (sameOrder) {
        throw new ConflictException('orderNo đã được dùng cho khóa học khác');
      }
    }

    const courseData: Prisma.CourseCreateInput = {
      title: dto.title,
      description: dto.description,
      orderNo: dto.orderNo,
      difficulty: dto.difficulty,
      estimatedHours: dto.estimatedHours,
      imageUrl: dto.imageUrl,
      tags: dto.tags ?? [],
      instructor: { connect: { id: dto.instructorId } },
      price: dto.price ?? 0,
      currency: normalizeCurrency(dto.currency) ?? 'VND',
      maxStudents: dto.maxStudents ?? 20,
      language: dto.language ?? undefined,
      prerequisites: dto.prerequisites ?? [],
      isPublished: dto.isPublished ?? false,
    };

    const createdCourse = await this.prisma.course.create({
      data: courseData,
    });

    let totalLessons = 0;
    let totalDuration = 0;

    for (const lessonDto of dto.lessons) {
      const lesson = await this.prisma.lesson.create({
        data: {
          course: { connect: { id: createdCourse.id } },
          title: lessonDto.title,
          description: lessonDto.description,
          orderNo: lessonDto.orderNo,
          difficulty: lessonDto.difficulty,
          estimatedTime: lessonDto.estimatedTime,
          isLocked: lessonDto.isLocked,
          objectives: lessonDto.objectives ?? [],
        },
      });

      totalLessons++;
      totalDuration += lessonDto.estimatedTime ?? 0;

      for (const activityDto of lessonDto.activities) {
        await this.prisma.activity.create({
          data: {
            lesson: { connect: { id: lesson.id } },
            type: activityDto.type,
            orderNo: activityDto.orderNo,
            title: activityDto.title,
            content: activityDto.content,
            timeLimit: activityDto.timeLimit,
            maxAttempts: activityDto.maxAttempts,
            passingScore: activityDto.passingScore,
            difficulty: activityDto.difficulty,
            points: activityDto.points,
            instructions: activityDto.instructions,
            hints: activityDto.hints,
            mediaUrls: activityDto.mediaUrls,
          },
        });
      }
    }

    await this.prisma.course.update({
      where: { id: createdCourse.id },
      data: {
        totalLessons,
        totalDuration,
      },
    });

    return createdCourse;
  }

  async findById(id: string): Promise<Course> {
    const course = await this.courseRepository.findById(id);
    if (!course) throw new NotFoundException(`Course with id ${id} not found`);
    return course;
  }

  async update(id: string, dto: UpdateCourseDto): Promise<Course> {
    await this.ensureExists(id);

    if (dto.price != null && dto.price < 0) {
      throw new BadRequestException('Giá không được âm');
    }

    // Optional rule: orderNo unique if provided
    if (dto.orderNo != null) {
      const other = await this.prisma.course.findFirst({
        where: { orderNo: dto.orderNo, id: { not: id } },
        select: { id: true },
      });
      if (other)
        throw new ConflictException('orderNo đã được dùng cho khóa học khác');
    }

    const data = {
      ...(dto.title != null && { title: dto.title }),
      ...(dto.description != null && { description: dto.description }),
      ...(dto.orderNo != null && { orderNo: dto.orderNo }),
      ...(dto.difficulty != null && { difficulty: dto.difficulty }),
      ...(dto.estimatedHours != null && { estimatedHours: dto.estimatedHours }),
      ...(dto.imageUrl != null && { imageUrl: dto.imageUrl }),
      ...(dto.tags != null && { tags: dto.tags }),
      ...(dto.currency != null && {
        currency: normalizeCurrency(dto.currency),
      }),
      ...(dto.price != null && { price: dto.price }),
      ...(dto.maxStudents != null && { maxStudents: dto.maxStudents }),
      ...(dto.language != null && { language: dto.language }),
      ...(dto.prerequisites != null && { prerequisites: dto.prerequisites }),
      ...(dto.isPublished != null && { isPublished: dto.isPublished }),
      ...(dto.totalLessons != null && { totalLessons: dto.totalLessons }),
      ...(dto.totalDuration != null && { totalDuration: dto.totalDuration }),
    };

    return this.courseRepository.update(id, data);
  }

  async delete(id: string): Promise<Course> {
    await this.ensureExists(id);
    return this.courseRepository.delete(id);
  }

  list(params: FilterCourseRequestDto): Promise<PageResponseDto<Course>> {
    return this.courseRepository.list(params);
  }

  async publish(id: string): Promise<Course> {
    await this.ensureExists(id);
    return this.courseRepository.update(id, { isPublished: true });
  }

  async unpublish(id: string): Promise<Course> {
    await this.ensureExists(id);
    return this.courseRepository.update(id, { isPublished: false });
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.courseRepository.findById(id);
    if (!exists) throw new NotFoundException(`Course with id ${id} not found`);
  }
}
