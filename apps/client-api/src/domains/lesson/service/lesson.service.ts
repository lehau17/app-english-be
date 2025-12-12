import { PrismaRepository } from '@app/database';
import { AutoCertificateIssuerService } from '@app/shared/certificate';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { DifficultyLevel, Lesson, ProgressState } from '@prisma/client';
import { StudentAnalyticsTool } from '../../agent/tools/student-analytics.tool';
import { LearningPathService } from '../../learning-path/service/learning-path.service';
import { ParentNotificationService } from '../../parent/service/parent-notification.service';
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
  private readonly logger = new Logger(LessonService.name);

  constructor(
    private readonly lessonRepository: LessonRepository,
    private readonly parentNotificationService: ParentNotificationService,
    private readonly prisma: PrismaRepository,
    @Inject(forwardRef(() => AutoCertificateIssuerService))
    private readonly autoCertificateIssuer?: AutoCertificateIssuerService,
    private readonly learningPathService?: LearningPathService,
    private readonly analyticsTool?: StudentAnalyticsTool,
  ) {}

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
    const { userId, activityId, score, timeSpentSec } = dto;
    const p = await this.lessonRepository.completeActivity(
      userId,
      activityId,
      score,
      timeSpentSec,
    );

    // Trigger parent notification if activity completed successfully
    const passedStates: ProgressState[] = ['done', 'mastered', 'review_needed'];
    if (passedStates.includes(p.state as ProgressState)) {
      await this.notifyParentActivityCompleted(userId, activityId, score);
    }

    // Check course completion and trigger certificate issuance (async, non-blocking)
    this.checkCourseCompletionForCertificate(userId, activityId).catch(
      (error) => {
        // Log error but don't fail activity completion
        this.logger.error(
          `Failed to check course completion for certificate: ${error.message}`,
        );
      },
    );

    // Update learning path progress if lesson is part of active path (async, non-blocking)
    this.updateLearningPathProgress(userId, activityId).catch((error) => {
      // Log error but don't fail activity completion
      this.logger.warn(
        `Failed to update learning path progress: ${error.message}`,
      );
    });

    return {
      state: p.state as ProgressState,
      score: p.score ?? null,
      bestScore: p.bestScore ?? null,
      attemptsCount: p.attemptsCount ?? 1,
    };
  }

  /**
   * Check course completion and trigger certificate issuance if eligible
   */
  private async checkCourseCompletionForCertificate(
    userId: string,
    activityId: string,
  ): Promise<void> {
    if (!this.autoCertificateIssuer) {
      return; // Service not available
    }

    try {
      // Get activity with lesson and course info
      const activity = await this.prisma.activity.findUnique({
        where: { id: activityId },
        include: {
          lesson: {
            select: {
              id: true,
              courseId: true,
            },
          },
        },
      });

      if (!activity?.lesson) {
        return;
      }

      const courseId = activity.lesson.courseId;

      // Get student's classrooms for this course
      const classroomStudents = await this.prisma.classroomStudent.findMany({
        where: {
          studentId: userId,
          isActive: true,
          classroom: {
            courseId,
            status: { in: ['ongoing', 'completed'] },
          },
        },
        select: {
          classroomId: true,
        },
        take: 1, // Use first active classroom
      });

      if (classroomStudents.length === 0) {
        return; // Student not enrolled in any classroom for this course
      }

      const classroomId = classroomStudents[0].classroomId;

      // Check and issue certificate (async, non-blocking)
      await this.autoCertificateIssuer.checkAndIssueCertificate(
        userId,
        courseId,
        classroomId,
      );
    } catch (error) {
      // Silently fail - don't break activity completion
      this.logger.error(
        `Error checking course completion for certificate: ${error.message}`,
      );
    }
  }

  /**
   * Smart next lesson logic with learning path support
   * Priority: Active Learning Path > Weak Areas > Level Matching > Fallback
   */
  async findNextLessonForUserSmart(userId: string): Promise<
    | NextLessonWithActivityResponseDto
    | {
        type: 'enrollment_required';
        courseId: string;
        message: string;
        classrooms: any[];
      }
    | null
  > {
    try {
      // 1. Check active learning path
      if (this.learningPathService) {
        const activePath =
          await this.learningPathService.findActiveByUserId(userId);
        if (
          activePath &&
          activePath.currentStep < activePath.activityIds.length
        ) {
          const nextActivityId = activePath.activityIds[activePath.currentStep];

          // Map activity to lesson and course
          const activity = await this.prisma.activity.findUnique({
            where: { id: nextActivityId },
            include: {
              lesson: {
                select: {
                  id: true,
                  courseId: true,
                },
              },
            },
          });

          if (!activity || !activity.lesson) {
            this.logger.warn(
              `Activity ${nextActivityId} not found or has no lesson. Advancing path step.`,
            );
            // Advance to next step since this activity is invalid
            if (this.learningPathService) {
              await this.learningPathService.advanceStep(activePath.id, userId);
            }
            // Continue with fallback logic
            return null;
          }

          const courseId = activity.lesson.courseId;
          const lessonId = activity.lesson.id;

          // 2. Check enrollment (REQUIRED)
          const enrollment = await this.checkEnrollmentForCourse(
            userId,
            courseId,
          );
          if (!enrollment || !enrollment.isPurchased) {
            // Find classrooms offering this course
            const classrooms = await this.findClassroomsByCourse(courseId);
            return {
              type: 'enrollment_required',
              courseId: courseId,
              message: 'Cần đăng ký lớp học để học course này',
              classrooms,
            };
          }

          // 3. If enrolled, get the specific lesson containing this activity
          const lessonFull = await this.getFull(lessonId, userId);

          // Get progress for the next activity
          const progress =
            await this.lessonRepository.getProgressByUserIdAndActivityId(
              userId,
              nextActivityId,
            );

          const activityWithProgress = {
            id: activity.id,
            lessonId: activity.lessonId,
            type: activity.type,
            orderNo: activity.orderNo,
            title: activity.title,
            content: activity.content,
            passingScore: activity.passingScore,
            difficulty: activity.difficulty,
            points: activity.points,
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

          return {
            ...lessonFull,
            activity: activityWithProgress,
          };
        }
      }

      // 4. Analyze student profile (for suggestions)
      const profile = await this.analyzeStudentProfile(userId);

      // 5. Find matching lessons (only from enrolled classrooms)
      const candidates = await this.findLessonsMatchingProfile(profile, userId);

      // 6. Score và rank candidates
      const scored = candidates.map((lesson) => ({
        lesson,
        score: this.calculateScore(lesson, profile),
      }));
      scored.sort((a, b) => b.score - a.score);

      // 7. Return best match
      if (scored.length > 0) {
        return this.buildNextLessonResponse(scored[0].lesson, userId);
      }
    } catch (error) {
      this.logger.warn(
        `Smart next lesson failed, using fallback: ${error.message}`,
      );
    }

    // 8. Fallback to simple logic
    return this.findNextLessonForUser(userId);
  }

  /**
   * Trả về lesson đầu tiên chưa hoàn thành cho user (dùng cho HomePage)
   * Fallback method - simple logic
   */
  async findNextLessonForUser(
    userId: string,
  ): Promise<NextLessonWithActivityResponseDto | null> {
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

  /**
   * Helper method to notify parents when child completes an activity
   */
  private async notifyParentActivityCompleted(
    userId: string,
    activityId: string,
    score?: number,
  ) {
    try {
      // Get activity and user info using Prisma directly
      const activity = await this.prisma.activity.findUnique({
        where: { id: activityId },
        select: { title: true, type: true },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, firstName: true },
      });

      if (!activity || !user) return;

      const childName = user.displayName || user.firstName || 'Con';

      // Get time spent from progress record
      const progress = await this.prisma.progress.findUnique({
        where: { userId_activityId: { userId, activityId } },
        select: { timeSpentSec: true },
      });

      await this.parentNotificationService.notifyActivityCompleted({
        childId: userId,
        childName,
        activityTitle: activity.title,
        activityType: activity.type,
        score,
        timeSpent: progress?.timeSpentSec,
      });
    } catch (error) {
      // Don't fail the main operation if notification fails
      this.logger.error('Failed to send parent notification:', error);
    }
  }

  /**
   * Unlock next lesson when current lesson is completed
   */
  async unlockNextLesson(
    lessonId: string,
    userId: string,
  ): Promise<{ message: string; nextLessonId?: string }> {
    // 1. Check if current lesson is completed
    const isLessonCompleted = await this.isLessonCompleted(lessonId, userId);
    if (!isLessonCompleted) {
      throw new BadRequestException(
        'Current lesson must be completed before unlocking next lesson',
      );
    }

    // 2. Get current lesson to find course and order
    const currentLesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { courseId: true, orderNo: true },
    });

    if (!currentLesson) {
      throw new NotFoundException(`Lesson with id ${lessonId} not found`);
    }

    // 3. Find next lesson in the same course
    const nextLesson = await this.prisma.lesson.findFirst({
      where: {
        courseId: currentLesson.courseId,
        orderNo: { gt: currentLesson.orderNo },
      },
      orderBy: { orderNo: 'asc' },
    });

    if (!nextLesson) {
      return { message: 'No more lessons to unlock. Course completed!' };
    }

    // 4. Unlock next lesson if it's locked
    if (nextLesson.isLocked) {
      await this.prisma.lesson.update({
        where: { id: nextLesson.id },
        data: { isLocked: false },
      });

      return {
        message: `Next lesson "${nextLesson.title}" has been unlocked!`,
        nextLessonId: nextLesson.id,
      };
    }

    return {
      message: `Next lesson "${nextLesson.title}" is already unlocked`,
      nextLessonId: nextLesson.id,
    };
  }

  /**
   * Check if a lesson is completed by checking if all activities are completed
   */
  private async isLessonCompleted(
    lessonId: string,
    userId: string,
  ): Promise<boolean> {
    // Get all activities for the lesson
    const activities = await this.prisma.activity.findMany({
      where: { lessonId },
      select: { id: true },
    });

    if (activities.length === 0) {
      return false; // No activities means lesson is not completable
    }

    // Check if all activities have completed progress
    const completedActivities = await this.prisma.progress.count({
      where: {
        userId,
        activityId: { in: activities.map((a) => a.id) },
        state: {
          in: [
            ProgressState.done,
            ProgressState.mastered,
            ProgressState.review_needed,
          ],
        },
      },
    });

    return completedActivities === activities.length;
  }

  /**
   * Check if student enrolled in any classroom offering this course
   */
  private async checkEnrollmentForCourse(
    userId: string,
    courseId: string,
  ): Promise<{ isPurchased: boolean; classroomId: string } | null> {
    // Find classrooms offering this course
    const enrollment = await this.prisma.classroomStudent.findFirst({
      where: {
        studentId: userId,
        isActive: true,
        isPurchased: true,
        classroom: {
          courseId,
          isActive: true,
          status: {
            in: ['ongoing', 'upcoming'],
          },
        },
      },
      select: {
        isPurchased: true,
        classroomId: true,
      },
    });

    return enrollment;
  }

  /**
   * Find classrooms offering a course
   */
  private async findClassroomsByCourse(courseId: string): Promise<any[]> {
    const classrooms = await this.prisma.classroom.findMany({
      where: {
        courseId,
        isActive: true,
        status: {
          in: ['ongoing', 'upcoming'],
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        course: {
          select: {
            title: true,
            price: true,
          },
        },
      },
    });

    return classrooms;
  }

  /**
   * Get next lesson from a specific course
   */
  private async getNextLessonFromCourse(
    courseId: string,
    userId: string,
  ): Promise<NextLessonWithActivityResponseDto | null> {
    const lessons = await this.lessonRepository.listLessonsOfCourse(courseId);

    for (const lesson of lessons) {
      const summary = await this.lessonRepository.getLessonProgressSummary(
        lesson.id,
        userId,
      );
      if (summary.completion < 100) {
        const nextActivity = await this.lessonRepository.getNextActivityForUser(
          lesson.id,
          userId,
        );

        const lessonFull = await this.getFull(lesson.id, userId);

        let activityWithProgress = null;
        if (nextActivity) {
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

        return {
          ...lessonFull,
          activity: activityWithProgress,
        };
      }
    }

    return null;
  }

  /**
   * Analyze student profile
   */
  private async analyzeStudentProfile(userId: string): Promise<any> {
    if (!this.analyticsTool) {
      return {
        currentLevel: DifficultyLevel.beginner,
        weakAreas: [],
        goals: {},
      };
    }

    try {
      const studentData = await this.analyticsTool.getStudentData(
        userId,
        'all',
      );

      // Determine current level
      let currentLevel: DifficultyLevel = DifficultyLevel.beginner;
      if (studentData.averageScore >= 80) {
        currentLevel = DifficultyLevel.advanced;
      } else if (studentData.averageScore >= 60) {
        currentLevel = DifficultyLevel.intermediate;
      }

      // Identify weak areas
      const weakAreas: string[] = [];
      const skillBreakdown = studentData.skillBreakdown || {
        grammar: 0,
        vocabulary: 0,
        listening: 0,
        speaking: 0,
        reading: 0,
        writing: 0,
      };
      if (skillBreakdown.grammar < 60) weakAreas.push('grammar');
      if (skillBreakdown.vocabulary < 60) weakAreas.push('vocabulary');
      if (skillBreakdown.listening < 60) weakAreas.push('listening');
      if (skillBreakdown.speaking < 60) weakAreas.push('speaking');
      if (skillBreakdown.reading < 60) weakAreas.push('reading');
      if (skillBreakdown.writing < 60) weakAreas.push('writing');

      return {
        currentLevel,
        weakAreas: weakAreas.length > 0 ? weakAreas : ['vocabulary'],
        goals: {
          targetLevel:
            currentLevel === DifficultyLevel.beginner
              ? DifficultyLevel.intermediate
              : DifficultyLevel.advanced,
        },
        skillBreakdown,
      };
    } catch (error) {
      this.logger.warn(`Profile analysis failed: ${error.message}`);
      return {
        currentLevel: DifficultyLevel.beginner,
        weakAreas: ['vocabulary'],
        goals: {},
      };
    }
  }

  /**
   * Find lessons matching student profile (only from enrolled classrooms)
   */
  private async findLessonsMatchingProfile(
    profile: any,
    userId: string,
  ): Promise<Lesson[]> {
    // Get enrolled courses
    const courses = await this.lessonRepository.listCoursesOfUser(userId);

    // Get all lessons from enrolled courses
    const allLessons: Lesson[] = [];
    for (const course of courses) {
      const lessons = await this.lessonRepository.listLessonsOfCourse(
        course.id,
      );
      allLessons.push(...lessons);
    }

    return allLessons;
  }

  /**
   * Calculate score for lesson based on profile
   */
  private calculateScore(lesson: Lesson, profile: any): number {
    let score = 0;

    // Level matching (0-30 points)
    if (lesson.difficulty === profile.currentLevel) {
      score += 30;
    } else if (
      (profile.currentLevel === DifficultyLevel.beginner &&
        lesson.difficulty === DifficultyLevel.intermediate) ||
      (profile.currentLevel === DifficultyLevel.intermediate &&
        lesson.difficulty === DifficultyLevel.advanced)
    ) {
      score += 20; // One level up is good
    }

    // Progress bonus (0-10 points) - prefer in-progress lessons
    // This will be calculated when we check progress

    return score;
  }

  /**
   * Build next lesson response
   */
  private async buildNextLessonResponse(
    lesson: Lesson,
    userId: string,
  ): Promise<NextLessonWithActivityResponseDto> {
    const lessonFull = await this.getFull(lesson.id, userId);

    const nextActivity = await this.lessonRepository.getNextActivityForUser(
      lesson.id,
      userId,
    );

    let activityWithProgress = null;
    if (nextActivity) {
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

    return {
      ...lessonFull,
      activity: activityWithProgress,
    };
  }

  /**
   * Update learning path progress when lesson/activity is completed
   */
  private async updateLearningPathProgress(
    userId: string,
    activityId: string,
  ): Promise<void> {
    if (!this.learningPathService) return;

    try {
      // Get active learning path
      const activePath =
        await this.learningPathService.findActiveByUserId(userId);
      if (!activePath) return;

      // Check if this activity is in the path
      const activityIndex = activePath.activityIds.indexOf(activityId);
      if (activityIndex === -1) {
        // Activity not in path, no action needed
        return;
      }

      // Check if this is the current step
      if (activityIndex !== activePath.currentStep) {
        // Not the current step, user might be working ahead or behind
        this.logger.debug(
          `Activity ${activityId} at index ${activityIndex} but current step is ${activePath.currentStep}`,
        );
        return;
      }

      // Get activity to find lesson (for completion check)
      const activity = await this.prisma.activity.findUnique({
        where: { id: activityId },
        select: {
          lessonId: true,
        },
      });

      if (!activity) {
        this.logger.warn(`Activity ${activityId} not found in database`);
        return;
      }

      // Check if lesson containing this activity is completed
      const lessonCompleted = await this.isLessonCompleted(
        activity.lessonId,
        userId,
      );

      if (lessonCompleted) {
        // Advance to next step in learning path
        await this.learningPathService.advanceStep(activePath.id, userId);

        this.logger.log(
          `Advanced learning path ${activePath.id} from step ${activePath.currentStep} to ${activePath.currentStep + 1}`,
        );

        // Check if path is completed
        const updatedPath = await this.learningPathService.findById(
          activePath.id,
          userId,
        );
        if (updatedPath.isCompleted) {
          this.logger.log(
            `Learning path ${activePath.id} completed for user ${userId}`,
          );
          // TODO: Generate new recommendations or suggest next path
        }
      }
    } catch (error) {
      // Silent failure - don't break activity completion
      this.logger.warn(
        `Failed to update learning path progress: ${error.message}`,
      );
    }
  }
}
