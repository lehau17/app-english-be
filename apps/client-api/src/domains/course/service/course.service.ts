import { PrismaRepository } from '@app/database';
import { KafkaService, TTSTaskMessage } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Course, UserRole } from '@prisma/client';
import { GoogleTranslateFreeService } from '../../google-translate/google-translate.service';
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
  private readonly logger = new Logger(CourseService.name);

  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly prisma: PrismaRepository,
    private readonly googleTranslateFreeService: GoogleTranslateFreeService,
    private readonly kafkaService: KafkaService,
  ) { }

  // service.ts (đoạn create)
  async create(dto: CreateCourseDto): Promise<Course> {
    // 1) Validate instructor
    const instructor = await this.prisma.user.findUnique({ where: { id: dto.instructorId } });
    if (!instructor) throw new BadRequestException('Instructor không tồn tại');
    if (instructor.role !== UserRole.teacher && instructor.role !== UserRole.admin) {
      throw new BadRequestException('Instructor phải có vai trò TEACHER hoặc ADMIN');
    }
    if (dto.price != null && dto.price < 0) {
      throw new BadRequestException('Giá không được âm');
    }

    // 2) Optional: orderNo unique ở cấp Course
    if (dto.orderNo != null) {
      const sameOrder = await this.prisma.course.findFirst({ where: { orderNo: dto.orderNo } });
      if (sameOrder) throw new ConflictException('orderNo đã được dùng cho khóa học khác');
    }

    // 3) Validate trùng order trong lesson/activity (trước khi ghi DB)
    const lessonOrders = new Set<number>();
    for (const ls of dto.lessons) {
      if (lessonOrders.has(ls.orderNo)) {
        throw new BadRequestException(`Trùng orderNo giữa các lesson: ${ls.orderNo}`);
      }
      lessonOrders.add(ls.orderNo);

      const actOrders = new Set<number>();
      for (const ac of ls.activities) {
        if (actOrders.has(ac.orderNo)) {
          throw new BadRequestException(`Trùng orderNo trong activities của lesson "${ls.title}": ${ac.orderNo}`);
        }
        actOrders.add(ac.orderNo);
      }
    }

    // 4) Convert minutes -> hours cho course
    const estimatedHours =
      dto.estimatedTime != null ? Math.round((dto.estimatedTime / 60) * 100) / 100 : undefined;

    // 5) Transaction
    // We'll collect audio generation tasks during the transaction and run them after commit
    const pendingAudioTasks: Array<{
      activityId: string;
      itemsIndex: number[]; // indices of items needing audio
      language?: string;
    }> = [];

    const result = await this.prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          title: dto.title,
          description: dto.description ?? undefined,
          orderNo: dto.orderNo ?? undefined,
          difficulty: dto.difficulty,
          estimatedHours, // DB field là hours
          imageUrl: dto.imageUrl ?? undefined,
          tags: dto.tags ?? [],
          instructor: { connect: { id: dto.instructorId } },
          price: dto.price ?? 0,
          currency: normalizeCurrency(dto.currency) ?? 'VND',
          maxStudents: dto.maxStudents ?? 20,
          language: dto.language ?? undefined,
          prerequisites: dto.prerequisites ?? [],
          isPublished: dto.isPublished ?? false,
        },
      });

      let totalLessons = 0;
      let totalDuration = 0; // minutes

      for (const lessonDto of dto.lessons) {
        const lesson = await tx.lesson.create({
          data: {
            course: { connect: { id: course.id } },
            title: lessonDto.title,
            description: lessonDto.description ?? undefined,
            orderNo: lessonDto.orderNo,
            difficulty: lessonDto.difficulty ?? dto.difficulty,
            estimatedTime: lessonDto.estimatedTime ?? undefined, // minutes
            isLocked: lessonDto.isLocked ?? true,
            objectives: lessonDto.objectives ?? [],
          },
        });

        totalLessons++;
        totalDuration += lessonDto.estimatedTime ?? 0;

        for (const activityDto of lessonDto.activities) {
          // --- Normalize content cho vocab: cho phép dữ liệu cũ 1 từ -> items[] ---
          const normalizedContent =
            activityDto.type === 'vocab'
              ? await this.normalizeVocabContent(activityDto.content)
              : activityDto.content;

          const createdActivity = await tx.activity.create({
            data: {
              lesson: { connect: { id: lesson.id } },
              type: activityDto.type as any, // nếu Prisma enum trùng literal
              orderNo: activityDto.orderNo,
              title: activityDto.title,
              content: normalizedContent,  // JSONB
              timeLimit: activityDto.timeLimit ?? undefined,
              maxAttempts: activityDto.maxAttempts ?? undefined,
              passingScore: activityDto.passingScore ?? undefined,
              difficulty: activityDto.difficulty ?? lessonDto.difficulty ?? dto.difficulty,
              points: activityDto.points ?? 10,
              instructions: activityDto.instructions ?? undefined,
              hints: activityDto.hints ?? [],
              mediaUrls: activityDto.mediaUrls ?? [],
            },

          });

          // If this is a vocab activity, check items without audioUrl and schedule generation
          if (normalizedContent && normalizedContent.kind === 'vocab') {
            const items = normalizedContent.data?.items || [];
            const indices: number[] = [];
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              if (!it.audioUrl || it.audioUrl === '') indices.push(i);
            }
            if (indices.length > 0) {
              pendingAudioTasks.push({
                activityId: createdActivity.id,
                itemsIndex: indices,
                language: dto.language ?? 'en',
              });
            }
          }
        }
      }

      await tx.course.update({
        where: { id: course.id },
        data: {
          totalLessons,
          totalDuration, // minutes
        },
      });

      return course;
    });

    // After transaction commit, emit TTS tasks to background worker via Kafka
    if (pendingAudioTasks.length > 0) {
      this.logger.log(`Emitting ${pendingAudioTasks.length} TTS tasks to background worker`);

      for (const task of pendingAudioTasks) {
        const message: TTSTaskMessage = {
          activityId: task.activityId,
          itemsIndex: task.itemsIndex,
          language: task.language ?? 'en',
          taskId: `${task.activityId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
        };

        try {
          this.kafkaService.send('tts-audio-generation', message);
        } catch (error) {
          this.logger.error(`Failed to emit TTS task: ${error.message}`, error);
        }
      }

      // Clear the array immediately since we've queued the tasks
      pendingAudioTasks.length = 0;
    }

    return result;
  }

/**
 * Hỗ trợ cả 2 shape:
 *  - MỚI: { kind:'vocab', data:{ items:[ {word,definition,...}, ...] } }
 *  - CŨ : { kind:'vocab', data:{ word, definition, examples?, imageUrl?, audioUrl? } }
 * Trả về luôn shape MỚI.
 */
 async normalizeVocabContent(content: any) {
    if (!content || content.kind !== 'vocab') return content;

    const data = content.data ?? {};
    if (Array.isArray(data.items)) return content;

    if (data.word && data.definition) {
      return {
        kind: 'vocab',
        data: {
          items: [
            {
              word: data.word,
              definition: data.definition,
              examples: data.examples ?? [],
              imageUrl: data.imageUrl ?? undefined,
              audioUrl: data.audioUrl ?? (await this.googleTranslateFreeService.createAudioWithUrl(data.word, "en")).url
            },
          ],
        },
      };
    }
    // fallback giữ nguyên nếu không match
    return content;
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
