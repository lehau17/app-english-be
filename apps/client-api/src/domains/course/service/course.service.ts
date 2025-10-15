import { PrismaRepository } from '@app/database';
import {
    KafkaService,
    Neo4jEntityType,
    Neo4jSyncMessage,
    Neo4jSyncOperation,
    TTSTaskMessage,
} from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Course, LanguageCode, Prisma, UserRole } from '@prisma/client';
import { GoogleTranslateFreeService } from '../../google-translate/google-translate.service';
import {
    CreateCourseDto,
    FilterCourseRequestDto,
    UpdateCourseDto,
} from '../dto/course.dto';
import { CourseRepository } from '../repository/course.repository';
import { SessionScheduleService } from './session-schedule.service';

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
        private readonly sessionScheduleService: SessionScheduleService,
    ) { }

    // service.ts (đoạn create)
    async create(dto: CreateCourseDto, currentUserId: string): Promise<Course> {
        // 1) Validate instructor - lấy từ token
        const instructor = await this.prisma.user.findUnique({
            where: { id: currentUserId },
        });
        if (!instructor) throw new BadRequestException('Instructor không tồn tại');
        if (
            instructor.role !== UserRole.teacher &&
            instructor.role !== UserRole.admin
        ) {
            throw new BadRequestException(
                'Instructor phải có vai trò TEACHER hoặc ADMIN',
            );
        }
        if (dto.price != null && dto.price < 0) {
            throw new BadRequestException('Giá không được âm');
        }

        // 2) Optional: orderNo unique ở cấp Course
        if (dto.orderNo != null) {
            const sameOrder = await this.prisma.course.findFirst({
                where: { orderNo: dto.orderNo },
            });
            if (sameOrder)
                throw new ConflictException('orderNo đã được dùng cho khóa học khác');
        }

        // 3) Validate trùng order trong lesson/activity (trước khi ghi DB)
        const lessonOrders = new Set<number>();
        for (const ls of dto.lessons) {
            if (lessonOrders.has(ls.orderNo)) {
                throw new BadRequestException(
                    `Trùng orderNo giữa các lesson: ${ls.orderNo}`,
                );
            }
            lessonOrders.add(ls.orderNo);

            const actOrders = new Set<number>();
            for (const ac of ls.activities) {
                if (actOrders.has(ac.orderNo)) {
                    throw new BadRequestException(
                        `Trùng orderNo trong activities của lesson "${ls.title}": ${ac.orderNo}`,
                    );
                }
                actOrders.add(ac.orderNo);
            }
        }

        // 3.1) Validate session schedule nếu có
        if (dto.sessionSchedules && dto.sessionSchedules.length > 0) {
            const sessionNumbers = new Set<number>();
            for (const schedule of dto.sessionSchedules) {
                if (sessionNumbers.has(schedule.sessionNumber)) {
                    throw new BadRequestException(
                        `Trùng số buổi trong lịch học: ${schedule.sessionNumber}`,
                    );
                }
                sessionNumbers.add(schedule.sessionNumber);

                // Kiểm tra các activity có tồn tại trong course không
                const activityIds = new Set<string>();
                for (const ls of dto.lessons) {
                    for (const act of ls.activities) {
                        // Giả lập ID tạm thời để so sánh
                        activityIds.add(act.title);
                    }
                }

                // Kiểm tra trùng lặp trong order activities
                const activityOrders = new Set<number>();
                for (const activity of schedule.activities) {
                    if (activityOrders.has(activity.orderNo)) {
                        throw new BadRequestException(
                            `Trùng orderNo trong activities của buổi học ${schedule.sessionNumber}: ${activity.orderNo}`,
                        );
                    }
                    activityOrders.add(activity.orderNo);
                }
            }
        }

        // 4) Convert minutes -> hours cho course
        const estimatedHours =
            dto.estimatedTime != null
                ? Math.round((dto.estimatedTime / 60) * 100) / 100
                : undefined;

        // 5) Transaction
        // We'll collect audio generation tasks during the transaction and run them after commit
        const pendingAudioTasks: Array<{
            activityId: string;
            itemsIndex: number[]; // indices of items needing audio
            language?: string;
        }> = [];

        const result = await this.prisma.$transaction(async (tx) => {
            // Tạo Course
            const course = await tx.course.create({
                data: {
                    title: dto.title,
                    description: dto.description ?? undefined,
                    orderNo: dto.orderNo ?? undefined,
                    difficulty: dto.difficulty,
                    estimatedHours, // DB field là hours
                    imageUrl: dto.imageUrl ?? undefined,
                    tags: dto.tags ?? [],
                    instructor: { connect: { id: currentUserId } },
                    price: dto.price ?? 0,
                    currency: normalizeCurrency(dto.currency) ?? 'VND',
                    maxStudents: dto.maxStudents ?? 20,
                    language: dto.language ?? LanguageCode.en,
                    prerequisites: dto.prerequisites ?? [],
                    isPublished: dto.isPublished ?? false,
                    plannedSessions: dto.plannedSessions ?? 8, // Mặc định 8 buổi nếu không chỉ định
                },
            });

            let totalLessons = 0;
            let totalDuration = 0; // minutes

            // Tạo Lessons và Activities
            const createdActivities = new Map<string, string>(); // Map title -> id

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
                    const createdActivity = await tx.activity.create({
                        data: {
                            lesson: { connect: { id: lesson.id } },
                            type: activityDto.type as any, // nếu Prisma enum trùng literal
                            orderNo: activityDto.orderNo,
                            title: activityDto.title,
                            content: activityDto.content as any, // JSONB - content theo cấu trúc mới từ DTO
                            //   timeLimit: activityDto.timeLimit ?? undefined,
                            //   maxAttempts: activityDto.maxAttempts ?? undefined,
                            passingScore: activityDto.passingScore ?? undefined,
                            difficulty:
                                activityDto.difficulty ??
                                lessonDto.difficulty ??
                                dto.difficulty,
                            points: activityDto.points ?? 10,
                            instructions: activityDto.instructions ?? undefined,
                            hints: activityDto.hints ?? [],
                            mediaUrls: activityDto.mediaUrls ?? [],
                        },
                    });

                    // Lưu ID của activity đã tạo để dùng cho session schedule
                    // Sử dụng lesson orderNo và activity orderNo để tạo key duy nhất
                    const activityKey = `L${lessonDto.orderNo}A${activityDto.orderNo}`;
                    createdActivities.set(activityKey, createdActivity.id);

                    // If this is a vocab activity, check items without audioUrl and schedule generation
                    if (activityDto.type === 'vocab' && activityDto.content) {
                        const vocabContent = activityDto.content as any;
                        const items = vocabContent.items || [];
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

            // Tạo SessionSchedules nếu có
            if (dto.sessionSchedules && dto.sessionSchedules.length > 0) {
                for (const scheduleDto of dto.sessionSchedules) {
                    // Tạo session schedule với các activities
                    await tx.sessionSchedule.create({
                        data: {
                            courseId: course.id,
                            sessionNumber: scheduleDto.sessionNumber,
                            title: scheduleDto.title,
                            description: scheduleDto.description,
                            activities: {
                                create: scheduleDto.activities.map(activityItem => {
                                    let actualActivityId: string | undefined;

                                    // Kiểm tra xem activityId là UUID hay reference format (L1A2)
                                    if (activityItem.activityId.match(/^L\d+A\d+$/i)) {
                                        // Format L1A2 - lấy từ map
                                        actualActivityId = createdActivities.get(activityItem.activityId);
                                    } else {
                                        // Assume it's a UUID - kiểm tra xem có trong map không (dành cho trường hợp activity đã tồn tại)
                                        actualActivityId = activityItem.activityId;
                                    }

                                    if (!actualActivityId) {
                                        this.logger.warn(`Activity với reference ${activityItem.activityId} không tìm thấy`);
                                        return null;
                                    }

                                    return {
                                        activityId: actualActivityId,
                                        orderNo: activityItem.orderNo,
                                    };
                                }).filter(Boolean) // Lọc bỏ các mục null
                            }
                        },
                    });
                }
            }

            return course;
        });

        // After transaction commit, emit TTS tasks to background worker via Kafka
        if (pendingAudioTasks.length > 0) {
            this.logger.log(
                `Emitting ${pendingAudioTasks.length} TTS tasks to background worker`,
            );

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

        // Emit Neo4j sync event
        this.emitNeo4jSyncEvent(
            Neo4jSyncOperation.CREATE,
            Neo4jEntityType.COURSE,
            result.id,
        );

        return result;
    }

    /**
     * Helper method to generate audio URLs for vocab items that don't have them
     */
    private async generateMissingAudioUrls(
        vocabContent: any,
        language: string = 'en',
    ): Promise<void> {
        if (!vocabContent?.items || !Array.isArray(vocabContent.items)) return;

        for (const item of vocabContent.items) {
            if (!item.audioUrl && item.word) {
                try {
                    const audioResult =
                        await this.googleTranslateFreeService.createAudioWithUrl(
                            item.word,
                            language,
                        );
                    item.audioUrl = audioResult.url;
                } catch (error) {
                    this.logger.warn(
                        `Failed to generate audio for word: ${item.word}`,
                        error,
                    );
                }
            }
        }
    }

    async findById(id: string): Promise<
        Prisma.CourseGetPayload<{
            include: {
                instructor: {
                    select: {
                        id: true;
                        firstName: true;
                        lastName: true;
                        email: true;
                        displayName: true;
                        avatarUrl: true;
                    };
                };
                lessons: {
                    orderBy: { orderNo: 'asc' };
                    include: {
                        activities: {
                            orderBy: { orderNo: 'asc' };
                        };
                    };
                };
                sessionSchedules: {
                    orderBy: { sessionNumber: 'asc' };
                    include: {
                        activities: {
                            orderBy: { orderNo: 'asc' };
                            include: {
                                activity: true;
                            };
                        };
                    };
                };
            };
        }>
    > {
        const course = await this.prisma.course.findUnique({
            where: { id },
            include: {
                instructor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        displayName: true,
                        avatarUrl: true,
                    },
                },
                lessons: {
                    orderBy: { orderNo: 'asc' },
                    include: {
                        activities: {
                            orderBy: { orderNo: 'asc' },
                        },
                    },
                },
                sessionSchedules: {
                    orderBy: { sessionNumber: 'asc' },
                    include: {
                        activities: {
                            orderBy: { orderNo: 'asc' },
                            include: {
                                activity: true,
                            },
                        },
                    },
                },
            },
        });
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

        // Session schedule validation if provided
        if (dto.sessionSchedules && dto.sessionSchedules.length > 0) {
            const sessionNumbers = new Set<number>();
            for (const schedule of dto.sessionSchedules) {
                if (sessionNumbers.has(schedule.sessionNumber)) {
                    throw new BadRequestException(
                        `Trùng số buổi trong lịch học: ${schedule.sessionNumber}`,
                    );
                }
                sessionNumbers.add(schedule.sessionNumber);

                // Kiểm tra trùng lặp trong order activities
                const activityOrders = new Set<number>();
                for (const activity of schedule.activities) {
                    if (activityOrders.has(activity.orderNo)) {
                        throw new BadRequestException(
                            `Trùng orderNo trong activities của buổi học ${schedule.sessionNumber}: ${activity.orderNo}`,
                        );
                    }
                    activityOrders.add(activity.orderNo);
                }
            }
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
            ...(dto.plannedSessions != null && { plannedSessions: dto.plannedSessions }),
        };

        // Cập nhật thông tin cơ bản của Course
        const course = await this.courseRepository.update(id, data);

        // Cập nhật session schedules nếu có
        if (dto.sessionSchedules && dto.sessionSchedules.length > 0) {
            await this.sessionScheduleService.createSessionSchedules(id, dto.sessionSchedules);
        }

        // Emit Neo4j sync event
        this.emitNeo4jSyncEvent(
            Neo4jSyncOperation.UPDATE,
            Neo4jEntityType.COURSE,
            id,
        );

        return course;
    }

    async delete(id: string): Promise<Course> {
        await this.ensureExists(id);
        const course = await this.courseRepository.delete(id);

        // Emit Neo4j sync event
        this.emitNeo4jSyncEvent(
            Neo4jSyncOperation.DELETE,
            Neo4jEntityType.COURSE,
            id,
        );

        return course;
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

    /**
     * Emit Neo4j sync event to Kafka
     */
    private emitNeo4jSyncEvent(
        operation: Neo4jSyncOperation,
        entityType: Neo4jEntityType,
        entityId: string,
        metadata?: Record<string, any>,
    ): void {
        try {
            const message: Neo4jSyncMessage = {
                operation,
                entityType,
                entityId,
                taskId: `${entityType}-${operation}-${entityId}-${Date.now()}`,
                timestamp: Date.now(),
                metadata,
            };

            this.kafkaService.send('neo4j-sync', message);

            this.logger.log(
                `Emitted Neo4j sync event: ${operation} ${entityType} ${entityId}`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to emit Neo4j sync event: ${error.message}`,
                error.stack,
            );
            // Don't throw error - sync failure shouldn't block the main operation
        }
    }
}
