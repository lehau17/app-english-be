import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { Activity, Lesson, Prisma, ProgressState } from '@prisma/client';
import { CreateLessonDto, FilterLessonRequestDto } from '../dto/lesson.dto';

type SortOrder = 'asc' | 'desc';

@Injectable()
export class LessonRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  // ============ CRUD cơ bản ============

  async create(data: CreateLessonDto): Promise<Lesson> {
    return this.prisma.lesson.create({ data: data as any });
  }

  async findById(id: string): Promise<Lesson | null> {
    return this.prisma.lesson.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.LessonUpdateInput): Promise<Lesson> {
    return this.prisma.lesson.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Lesson> {
    return this.prisma.lesson.delete({ where: { id } });
  }

  async list(params: FilterLessonRequestDto): Promise<PageResponseDto<Lesson>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'orderNo',
      sortOrder = 'asc',
      courseId,
    } = params;

    const where: Prisma.LessonWhereInput = {
      courseId,
      OR: search
        ? [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const totalItems = await this.prisma.lesson.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const data = await this.prisma.lesson.findMany({
      where,
      skip: (safePage - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder as SortOrder },
    });

    return PageResponseDto.of(data, safePage, limit, totalItems);
  }

  // ============ BỔ SUNG CHO FLOW HỌC TẬP ============

  /**
   * Lấy lesson + activities (có _count.questions) + lessonDetails, sắp theo orderNo.
   */
  async getLessonFull(lessonId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        activities: {
          orderBy: { orderNo: 'asc' },
          include: {
            _count: { select: { attempts: true } }, // Sử dụng attempts thay vì questions
          },
        },
        lessonDetails: {
          orderBy: { orderNo: 'asc' },
        },
      },
    });
  }

  /**
   * Lấy toàn bộ activities của 1 lesson, kèm progress của user (nếu truyền userId)
   * và tổng số câu hỏi (để FE biết bài có bao nhiêu items).
   */
  async getActivitiesWithProgress(lessonId: string, userId?: string) {
    const activities = await this.prisma.activity.findMany({
      where: { lessonId },
      orderBy: { orderNo: 'asc' },
      include: {
        ...(userId
          ? {
              progress: {
                where: { userId },
                select: {
                  userId: true,
                  activityId: true,
                  state: true,
                  score: true,
                  bestScore: true,
                  attemptsCount: true,
                  updatedAt: true,
                },
              },
            }
          : {}),
      },
    });

    // Thêm question count cho mỗi activity
    if (userId) {
      return await Promise.all(
        activities.map(async (activity) => {
          const questionCount = await this.prisma.question.count({
            where: { activityId: activity.id },
          });
          return {
            ...activity,
            _count: { questions: questionCount },
          };
        }),
      );
    }

    return activities;
  }

  /**
   * Nhóm activities thành 3 hub cho Kids UI: games / exercises / speaking + media lessonDetails.
   */
  async getLessonHubs(lessonId: string, userId?: string) {
    const [acts, media] = await Promise.all([
      this.getActivitiesWithProgress(lessonId, userId),
      this.prisma.lessonDetail.findMany({
        where: {
          lessonId,
          OR: [
            { type: { equals: 'media', mode: 'insensitive' } },
            { type: { equals: 'video', mode: 'insensitive' } },
            { type: { equals: 'audio', mode: 'insensitive' } },
          ],
        },
        orderBy: { orderNo: 'asc' },
      }),
    ]);

    const games = [];
    const exercises = [];
    const speaking = [];

    for (const a of acts) {
      switch (a.type) {
        case 'mini_game':
        case 'vocab':
        case 'flashcard':
          games.push(a);
          break;
        case 'quiz':
        case 'grammar':
        case 'listening':
        case 'reading':
        case 'writing':
          exercises.push(a);
          break;
        case 'pronunciation':
        case 'speaking':
        case 'conversation':
          speaking.push(a);
          break;
        default:
          exercises.push(a);
      }
    }

    return { games, exercises, speaking, media };
  }

  /**
   * Tính overview tiến độ lesson của 1 user (bao nhiêu activity done/mastered..., % hoàn thành).
   */
  async getLessonProgressSummary(lessonId: string, userId: string) {
    const acts = await this.getActivitiesWithProgress(lessonId, userId);
    const total = acts.length;

    let done = 0;
    let mastered = 0;
    let inProgress = 0;

    for (const a of acts) {
      const p = (a as any).progress?.[0]; // Type assertion
      if (!p) continue;
      if (p.state === 'mastered') mastered++;
      if (p.state === 'done') done++;
      if (p.state === 'in_progress') inProgress++;
    }

    const passedCount = done + mastered;
    const completion = total > 0 ? Math.round((passedCount * 100) / total) : 0;

    return {
      totalActivities: total,
      done,
      mastered,
      inProgress,
      completion, // %
    };
  }

  /**
   * Tìm activity kế tiếp cho user trong lesson (linear flow).
   * Quy tắc: activity đầu tiên chưa "pass" là next.
   * "Pass" = state ∈ {done, mastered} VÀ (nếu có passingScore) bestScore/score ≥ passingScore.
   */
  async getNextActivityForUser(
    lessonId: string,
    userId: string,
  ): Promise<Activity | null> {
    const acts = await this.prisma.activity.findMany({
      where: { lessonId },
      orderBy: { orderNo: 'asc' },
      include: {
        progress: {
          where: { userId },
          select: { state: true, score: true, bestScore: true },
        },
      },
    });

    for (const a of acts) {
      const p = (a as any).progress?.[0]; // Type assertion để tránh lỗi TypeScript
      const passed = this.isPassed(a, p);
      if (!passed) {
        return a;
      }
    }
    return null;
  }

  /**
   * Kiểm tra user có được phép start 1 activity không, dựa trên:
   * - Phải vượt qua activity trước đó (nếu có) theo orderNo và passingScore.
   * - (Tuỳ chọn) Kiểm tra prereqs trong Activity.content.prereqs (nếu bạn có cấu hình).
   */
  async canStartActivity(
    userId: string,
    activityId: string,
  ): Promise<{ allowed: boolean; reason?: string; unmet?: any[] }> {
    const act = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        lessonId: true,
        orderNo: true,
        passingScore: true,
        content: true,
      },
    });
    if (!act) return { allowed: false, reason: 'activity_not_found' };

    // Check previous activity pass (linear gating)
    if (act.orderNo > 1) {
      const prev = await this.prisma.activity.findFirst({
        where: {
          lessonId: act.lessonId,
          orderNo: act.orderNo - 1,
        },
        select: { id: true, passingScore: true },
      });
      if (prev) {
        const prevProg = await this.prisma.progress.findUnique({
          where: {
            userId_activityId: { userId, activityId: prev.id },
          },
          select: { state: true, score: true, bestScore: true },
        });
        const prevPassed = this.isPassed(
          { passingScore: prev.passingScore } as any,
          prevProg,
        );
        if (!prevPassed)
          return { allowed: false, reason: 'previous_activity_not_passed' };
      }
    }

    // Optional: check custom prereqs in content JSON
    const unmet: any[] = [];
    const content = (act.content as any) || {};
    const prereqs: any[] = Array.isArray(content?.prereqs)
      ? content.prereqs
      : [];
    if (prereqs.length) {
      // gom sẵn progress của user cho các activity liên quan để tránh N+1
      const depActIds = prereqs
        .filter(
          (p) =>
            p?.type === 'activity_done' && typeof p.activityId === 'string',
        )
        .map((p) => p.activityId);

      const depProgress = depActIds.length
        ? await this.prisma.progress.findMany({
            where: { userId, activityId: { in: depActIds } },
            select: {
              activityId: true,
              state: true,
              score: true,
              bestScore: true,
            },
          })
        : [];

      const byAct = new Map(depProgress.map((d) => [d.activityId, d]));

      for (const pr of prereqs) {
        if (pr?.type === 'activity_done' && pr.activityId) {
          const prog = byAct.get(pr.activityId);
          const ok =
            prog &&
            (prog.state === 'done' || prog.state === 'mastered') &&
            (typeof pr.minScore === 'number'
              ? (prog.bestScore ?? prog.score ?? 0) >= pr.minScore
              : true);

          if (!ok) unmet.push(pr);
        }
        // Bạn có thể bổ sung thêm rule khác ở đây (watched_media, etc.)
      }
    }

    if (unmet.length)
      return { allowed: false, reason: 'unmet_prerequisites', unmet };
    return { allowed: true };
  }

  /**
   * Khởi động/đánh dấu user "bắt đầu" activity (tạo Progress nếu chưa có).
   */
  async startActivity(userId: string, activityId: string) {
    return this.prisma.progress.upsert({
      where: { userId_activityId: { userId, activityId } },
      create: { userId, activityId, state: 'in_progress' },
      update: { state: 'in_progress', updatedAt: new Date() },
    });
  }

  /**
   * Đánh dấu "hoàn thành" activity dựa trên điểm (để dùng sau khi chấm).
   * Không tạo Attempt ở đây (nên để service khác tạo Attempt), chỉ cập nhật Progress.
   */
  async completeActivity(userId: string, activityId: string, score?: number) {
    // lấy passingScore để quyết định state
    const act = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: { passingScore: true },
    });
    if (!act) throw new Error('activity_not_found');

    const pass =
      typeof act.passingScore === 'number'
        ? (score ?? 0) >= act.passingScore
        : true;

    return this.prisma.progress.upsert({
      where: { userId_activityId: { userId, activityId } },
      create: {
        userId,
        activityId,
        state: pass ? 'done' : 'review_needed',
        score: score ?? null,
        bestScore: score ?? null,
        attemptsCount: 1,
      },
      update: {
        state: pass ? 'done' : 'review_needed',
        score: score ?? undefined,
        bestScore: {
          set:
            score == null
              ? undefined
              : await this.computeBestScore(userId, activityId, score),
        },
        attemptsCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Tính bestScore mới (giữa bestScore cũ và score lần này).
   */
  private async computeBestScore(
    userId: string,
    activityId: string,
    newScore: number,
  ) {
    const prev = await this.prisma.progress.findUnique({
      where: { userId_activityId: { userId, activityId } },
      select: { bestScore: true },
    });
    const prevBest = prev?.bestScore ?? 0;
    return Math.max(prevBest, newScore);
  }

  /**
   * Helper: xác định 1 activity đã "pass" hay chưa theo Progress + passingScore.
   */
  private isPassed(
    activity: { passingScore?: number | null },
    progress?: {
      state?: ProgressState | null;
      score?: number | null;
      bestScore?: number | null;
    },
  ): boolean {
    if (!progress) return false;
    if (progress.state === 'mastered') return true;
    if (progress.state !== 'done') return false;

    if (typeof activity.passingScore === 'number') {
      const best = progress.bestScore ?? progress.score ?? 0;
      return best >= activity.passingScore;
    }
    return true;
  }

  /**
   * Lấy danh sách khoá học mà user đang học (qua bảng ClassroomStudent)
   */
  async listCoursesOfUser(userId: string) {
    const enrollments = await this.prisma.classroomStudent.findMany({
      where: { studentId: userId, isActive: true },
      include: {
        classroom: {
          include: {
            course: true,
          },
        },
      },
    });

    // Lọc ra những course duy nhất và loại bỏ null
    const courses = enrollments
      .map((e) => e.classroom?.course)
      .filter((course) => course != null);

    // Loại bỏ duplicate courses
    const uniqueCourses = courses.filter(
      (course, index, self) =>
        index === self.findIndex((c) => c.id === course.id),
    );

    return uniqueCourses;
  }

  /**
   * Lấy thống kê tổng quan của một lesson
   */
  async getLessonStats(lessonId: string) {
    const [lesson, activitiesCount, questionsCount] = await Promise.all([
      this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: {
          id: true,
          title: true,
          difficulty: true,
          estimatedTime: true,
          createdAt: true,
        },
      }),
      this.prisma.activity.count({ where: { lessonId } }),
      this.prisma.question.count({
        where: {
          activityId: {
            in: await this.prisma.activity
              .findMany({
                where: { lessonId },
                select: { id: true },
              })
              .then((acts) => acts.map((a) => a.id)),
          },
        },
      }),
    ]);

    if (!lesson) return null;

    return {
      ...lesson,
      totalActivities: activitiesCount,
      totalQuestions: questionsCount,
    };
  }

  /**
   * Lấy danh sách lesson thuộc một khoá học kèm progress của user
   */
  async listLessonsOfCourseWithProgress(courseId: string, userId?: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: { courseId },
      orderBy: { orderNo: 'asc' },
      include: {
        activities: {
          select: {
            id: true,
            type: true,
            passingScore: true,
            ...(userId
              ? {
                  progress: {
                    where: { userId },
                    select: {
                      state: true,
                      score: true,
                      bestScore: true,
                    },
                  },
                }
              : {}),
          },
        },
        _count: {
          select: { activities: true },
        },
      },
    });

    // Tính progress cho từng lesson nếu có userId
    if (userId) {
      return lessons.map((lesson) => {
        const activities = lesson.activities;
        const totalActivities = activities.length;
        let completedActivities = 0;

        for (const activity of activities) {
          const progress = (activity as any).progress?.[0];
          if (
            progress &&
            (progress.state === 'done' || progress.state === 'mastered')
          ) {
            completedActivities++;
          }
        }

        const completion =
          totalActivities > 0
            ? Math.round((completedActivities * 100) / totalActivities)
            : 0;

        return {
          ...lesson,
          progress: {
            totalActivities,
            completedActivities,
            completion,
          },
        };
      });
    }

    return lessons;
  }

  /**
   * Lấy danh sách lesson thuộc một khoá học
   */
  async listLessonsOfCourse(courseId: string) {
    return this.prisma.lesson.findMany({
      where: { courseId },
      orderBy: { orderNo: 'asc' },
    });
  }

  async getProgressByUserIdAndActivityId(userId: string, activityId: string) {
    return this.prisma.progress.findUnique({
      where: { userId_activityId: { userId, activityId } },
    });
  }
}
