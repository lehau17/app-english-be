import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
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
  async getFull(lessonId: string) {
    const lesson = await this.lessonRepository.getLessonFull(lessonId);
    if (!lesson)
      throw new NotFoundException(`Lesson with id ${lessonId} not found`);
    return lesson;
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

    // optional: enforce gating
    const gate = await this.lessonRepository.canStartActivity(
      userId,
      activityId,
    );
    if (!gate.allowed) {
      return { userId, activityId, state: ProgressState.not_started };
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
}
