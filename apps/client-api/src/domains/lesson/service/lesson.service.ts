import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Lesson, ProgressState } from '@prisma/client';
import {
  CanStartActivityRequestDto,
  CanStartActivityResponseDto,
  CompleteActivityRequestDto,
  CompleteActivityResponseDto,
  CreateLessonDto,
  FilterLessonRequestDto,
  GetLessonHubsRequestDto,
  GetLessonHubsResponseDto,
  LessonProgressSummaryDto,
  NextActivityResponseDto,
  NextLessonWithActivityResponseDto,
  StartActivityRequestDto,
  StartActivityResponseDto,
  UpdateLessonDto,
} from '../dto/lesson.dto';
import { LessonRepository } from '../repository/lesson.repository';

@Injectable()
export class LessonService {
  constructor(private readonly lessonRepository: LessonRepository) {}

  /** ===== CRUD ===== */

  async create(dto: CreateLessonDto): Promise<Lesson> {
    return this.lessonRepository.create(dto);
  }

  async findById(id: string): Promise<Lesson> {
    const lesson = await this.lessonRepository.findById(id);
    if (!lesson) throw new NotFoundException(`Lesson with id ${id} not found`);
    return lesson;
  }

  async update(id: string, dto: UpdateLessonDto): Promise<Lesson> {
    await this.ensureExists(id);
    return this.lessonRepository.update(id, dto);
  }

  async delete(id: string): Promise<Lesson> {
    await this.ensureExists(id);
    return this.lessonRepository.delete(id);
  }

  async list(params: FilterLessonRequestDto): Promise<PageResponseDto<Lesson>> {
    return this.lessonRepository.list(params);
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.lessonRepository.findById(id);
    if (!exists) throw new NotFoundException(`Lesson with id ${id} not found`);
  }

  /** ===== Learning Flow ===== */

  /**
   * Lấy lesson + activities (+_count.questions) + lessonDetails, sắp thứ tự
   */
  async getFull(lessonId: string, userId?: string) {
    const lesson = await this.lessonRepository.getLessonFull(lessonId);
    if (!lesson)
      throw new NotFoundException(`Lesson with id ${lessonId} not found`);

    // Nếu có userId, thêm progress cho activities
    if (userId) {
      const activitiesWithProgress =
        await this.lessonRepository.getActivitiesWithProgress(lessonId, userId);

      // Normalize vocab content format
      const normalizedActivities = activitiesWithProgress.map((activity) => {
        if (activity.type === 'vocab' && Array.isArray(activity.content)) {
          return {
            ...activity,
            content: {
              items: activity.content,
            },
          };
        }
        return activity;
      });

      return {
        ...lesson,
        activities: normalizedActivities,
      };
    }

    // Normalize vocab content format even without userId
    const normalizedActivities = lesson.activities.map((activity) => {
      if (activity.type === 'vocab' && Array.isArray(activity.content)) {
        return {
          ...activity,
          content: {
            items: activity.content,
          },
        };
      }
      return activity;
    });

    return {
      ...lesson,
      activities: normalizedActivities,
    };
  }

  /**
   * Lấy hub (games/exercises/speaking) + media cho Kids UI
   */
  async getHubs(
    lessonId: string,
    req?: GetLessonHubsRequestDto,
  ): Promise<GetLessonHubsResponseDto> {
    await this.ensureExists(lessonId);
    const { userId } = req ?? {};
    const hubs = await this.lessonRepository.getLessonHubs(lessonId, userId);
    // map nhẹ: thêm questionCount & progress[0] → progress
    const mapAct = (arr: any[]) =>
      arr.map((a) => ({
        id: a.id,
        lessonId: a.lessonId,
        type: a.type,
        orderNo: a.orderNo,
        title: a.title,
        content: a.content,
        timeLimit: a.timeLimit,
        maxAttempts: a.maxAttempts,
        passingScore: a.passingScore,
        difficulty: a.difficulty,
        points: a.points,
        questionCount: a._count?.questions ?? 0,
        progress: a.progress?.[0] ?? undefined,
      }));

    return {
      games: mapAct(hubs.games),
      exercises: mapAct(hubs.exercises),
      speaking: mapAct(hubs.speaking),
      media: hubs.media,
    };
  }

  /**
   * Tóm tắt tiến độ lesson của user
   */
  async getProgressSummary(
    lessonId: string,
    userId: string,
  ): Promise<LessonProgressSummaryDto> {
    await this.ensureExists(lessonId);
    return this.lessonRepository.getLessonProgressSummary(lessonId, userId);
  }

  /**
   * Activity tiếp theo cho nút Continue (linear)
   */
  async getNextActivity(
    lessonId: string,
    userId: string,
  ): Promise<NextActivityResponseDto> {
    await this.ensureExists(lessonId);
    const a = await this.lessonRepository.getNextActivityForUser(
      lessonId,
      userId,
    );
    if (!a) return { nextActivity: null };
    return {
      nextActivity: {
        id: a.id,
        lessonId: a.lessonId,
        type: a.type,
        orderNo: a.orderNo,
        title: a.title,
        content: a.content,
        timeLimit: a.timeLimit,
        maxAttempts: a.maxAttempts,
        passingScore: a.passingScore,
        difficulty: a.difficulty,
        points: a.points,
        questionCount: undefined,
        progress: undefined,
      },
    };
  }

  /**
   * Kiểm tra có được start activity hay không (gating)
   */
  async canStartActivity(
    dto: CanStartActivityRequestDto,
  ): Promise<CanStartActivityResponseDto> {
    const { userId, activityId } = dto;
    const result = await this.lessonRepository.canStartActivity(
      userId,
      activityId,
    );
    return result;
  }

  /**
   * Bắt đầu activity: tạo/đặt Progress = in_progress
   */
  async startActivity(
    dto: StartActivityRequestDto,
  ): Promise<StartActivityResponseDto> {
    const { userId, activityId } = dto;

    // enforce gating - throw error if not allowed
    const gate = await this.lessonRepository.canStartActivity(
      userId,
      activityId,
    );
    if (!gate.allowed) {
      throw new BadRequestException({
        message: 'Cannot start activity',
        reason: gate.reason || 'Activity is not available for this user',
        unmet: gate.unmet || [],
      });
    }
    const foundProgress =
      await this.lessonRepository.getProgressByUserIdAndActivityId(
        userId,
        activityId,
      );
    if (foundProgress && foundProgress.state === ProgressState.done) {
      return {
        userId,
        activityId,
        state: foundProgress.state as ProgressState,
      };
    }

    const progress = await this.lessonRepository.startActivity(
      userId,
      activityId,
    );
    return { userId, activityId, state: progress.state as ProgressState };
  }

  /**
   * Hoàn thành activity dựa trên score (sau khi service chấm đã tạo Attempt)
   */
  async completeActivity(
    dto: CompleteActivityRequestDto,
  ): Promise<CompleteActivityResponseDto> {
    const { userId, activityId, score } = dto;
    const p = await this.lessonRepository.completeActivity(
      userId,
      activityId,
      score,
    );

    return {
      state: p.state as ProgressState,
      score: p.score ?? null,
      bestScore: p.bestScore ?? null,
      attemptsCount: p.attemptsCount ?? 1,
    };
  }

  /**
   * Trả về lesson đầu tiên chưa hoàn thành cho user (dùng cho HomePage)
   */
  async findNextLessonForUser(
    userId: string,
  ): Promise<NextLessonWithActivityResponseDto> {
    // 1. Lấy danh sách khoá học user đang học
    const courses = await this.lessonRepository.listCoursesOfUser(userId);
    // 2. Lấy tất cả lesson thuộc các khoá học đó
    const lessons: Lesson[] = [];
    for (const course of courses) {
      const courseLessons = await this.lessonRepository.listLessonsOfCourse(
        course.id,
      );
      lessons.push(...courseLessons);
    }

    // 3. Tìm lesson đầu tiên chưa hoàn thành
    for (const lesson of lessons) {
      const summary = await this.lessonRepository.getLessonProgressSummary(
        lesson.id,
        userId,
      );
      if (summary.completion < 100) {
        // 4. Tìm activity tiếp theo trong lesson này
        const nextActivity = await this.lessonRepository.getNextActivityForUser(
          lesson.id,
          userId,
        );

        // 5. Lấy lesson full với activities và progress
        const lessonFull = await this.getFull(lesson.id, userId);

        let activityWithProgress = null;
        if (nextActivity) {
          // 6. Lấy progress của activity này
          const progress =
            await this.lessonRepository.getProgressByUserIdAndActivityId(
              userId,
              nextActivity.id,
            );
          activityWithProgress = {
            id: nextActivity.id,
            lessonId: nextActivity.lessonId,
            type: nextActivity.type,
            orderNo: nextActivity.orderNo,
            title: nextActivity.title,
            content: nextActivity.content,
            timeLimit: nextActivity.timeLimit,
            maxAttempts: nextActivity.maxAttempts,
            passingScore: nextActivity.passingScore,
            difficulty: nextActivity.difficulty,
            points: nextActivity.points,
            progress: progress
              ? {
                  state: progress.state,
                  score: progress.score,
                  bestScore: progress.bestScore,
                  attemptsCount: progress.attemptsCount,
                  updatedAt: progress.updatedAt,
                }
              : null,
          };
        }

        // 7. Trả về lesson data với activity field
        return {
          ...lessonFull,
          activity: activityWithProgress,
        };
      }
    }

    return null;
  }

  /**
   * Trả về activity tiếp theo cho user (từ tất cả lessons của user)
   */
  async findNextActivityForUser(userId: string) {
    // 1. Lấy danh sách khoá học user đang học
    const courses = await this.lessonRepository.listCoursesOfUser(userId);
    // 2. Lấy tất cả lesson thuộc các khoá học đó
    const lessons: Lesson[] = [];
    for (const course of courses) {
      const courseLessons = await this.lessonRepository.listLessonsOfCourse(
        course.id,
      );
      lessons.push(...courseLessons);
    }

    // 3. Duyệt qua từng lesson để tìm activity tiếp theo chưa hoàn thành
    for (const lesson of lessons) {
      const nextActivity = await this.lessonRepository.getNextActivityForUser(
        lesson.id,
        userId,
      );
      if (nextActivity) {
        // 4. Lấy progress của activity này
        const progress =
          await this.lessonRepository.getProgressByUserIdAndActivityId(
            userId,
            nextActivity.id,
          );

        return {
          id: nextActivity.id,
          lessonId: nextActivity.lessonId,
          type: nextActivity.type,
          orderNo: nextActivity.orderNo,
          title: nextActivity.title,
          content: nextActivity.content,
          timeLimit: nextActivity.timeLimit,
          maxAttempts: nextActivity.maxAttempts,
          passingScore: nextActivity.passingScore,
          difficulty: nextActivity.difficulty,
          points: nextActivity.points,
          progress: progress
            ? {
                state: progress.state,
                score: progress.score,
                bestScore: progress.bestScore,
                attemptsCount: progress.attemptsCount,
                updatedAt: progress.updatedAt,
              }
            : null,
        };
      }
    }
    return null;
  }
}
