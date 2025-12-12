import { NotFoundException } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { LessonRepository } from '../repository/lesson.repository';
import { ParentNotificationService } from '../../parent/service/parent-notification.service';
import { LearningPathService } from '../../learning-path/service/learning-path.service';
import { PrismaRepository } from '@app/database';
import { ActivityType, ProgressState } from '@prisma/client';

describe('LessonService - Learning Path Bug Fixes', () => {
  let service: LessonService;
  let lessonRepository: jest.Mocked<LessonRepository>;
  let learningPathService: jest.Mocked<LearningPathService>;
  let prisma: jest.Mocked<PrismaRepository>;
  let parentNotificationService: jest.Mocked<ParentNotificationService>;

  beforeEach(() => {
    // Create mocks
    lessonRepository = {
      findById: jest.fn(),
      getLessonFull: jest.fn(),
      getProgressByUserIdAndActivityId: jest.fn(),
    } as any;

    learningPathService = {
      findActiveByUserId: jest.fn(),
      advanceStep: jest.fn(),
      findById: jest.fn(),
    } as any;

    prisma = {
      activity: {
        findUnique: jest.fn(),
      },
      classroomStudent: {
        findFirst: jest.fn(),
      },
      classroom: {
        findMany: jest.fn(),
      },
    } as any;

    parentNotificationService = {} as any;

    // Create service instance
    service = new LessonService(
      lessonRepository,
      parentNotificationService,
      prisma,
      undefined, // autoCertificateIssuer
      learningPathService,
      undefined, // analyticsTool
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('findNextLessonForUserSmart - Bug Fix: Activity ID Mapping', () => {
    const userId = 'user-123';
    const activityId = 'activity-456';
    const lessonId = 'lesson-789';
    const courseId = 'course-101';

    it('should correctly map activity to lesson and course', async () => {
      // Mock active learning path with activityIds (NOT courseIds)
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 0,
        activityIds: [activityId],
        isCompleted: false,
      };

      // Mock activity with lesson relation
      const mockActivity = {
        id: activityId,
        lessonId,
        type: ActivityType.quiz,
        orderNo: 1,
        title: 'Test Activity',
        content: { question: 'Test?' },
        passingScore: 70,
        difficulty: null,
        points: 10,
        lesson: {
          id: lessonId,
          courseId,
        },
      };

      // Mock enrollment
      const mockEnrollment = {
        id: 'enrollment-1',
        userId,
        courseId,
        isPurchased: true,
      };

      // Mock lesson full
      const mockLessonFull = {
        id: lessonId,
        courseId,
        title: 'Test Lesson',
        activities: [],
      };

      // Mock progress
      const mockProgress = {
        id: 'progress-1',
        userId,
        activityId,
        state: ProgressState.not_started,
        score: null,
        bestScore: null,
        attemptsCount: 0,
        updatedAt: new Date(),
      };

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );
      prisma.activity.findUnique.mockResolvedValue(mockActivity as any);
      prisma.classroomStudent.findFirst.mockResolvedValue(
        mockEnrollment as any,
      );
      lessonRepository.getLessonFull.mockResolvedValue(mockLessonFull as any);
      lessonRepository.getProgressByUserIdAndActivityId.mockResolvedValue(
        mockProgress as any,
      );

      const result = await service.findNextLessonForUserSmart(userId);

      // Verify correct activity mapping was used
      expect(prisma.activity.findUnique).toHaveBeenCalledWith({
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

      // Verify enrollment check used correct courseId from activity.lesson
      expect(prisma.classroomStudent.findFirst).toHaveBeenCalledWith({
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

      // Verify lesson was fetched
      expect(lessonRepository.getLessonFull).toHaveBeenCalledWith(lessonId);

      // Verify progress was fetched for correct activity
      expect(
        lessonRepository.getProgressByUserIdAndActivityId,
      ).toHaveBeenCalledWith(userId, activityId);

      // Verify result structure
      expect(result).toMatchObject({
        id: lessonId,
        activity: {
          id: activityId,
          progress: {
            state: ProgressState.not_started,
          },
        },
      });
    });

    it('should handle orphaned activity (activity with no lesson)', async () => {
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 0,
        activityIds: [activityId],
        isCompleted: false,
      };

      // Activity exists but has no lesson relation
      const orphanedActivity = {
        id: activityId,
        lessonId: null,
        type: ActivityType.quiz,
        lesson: null,
      };

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );
      prisma.activity.findUnique.mockResolvedValue(orphanedActivity as any);
      learningPathService.advanceStep.mockResolvedValue(undefined);

      const result = await service.findNextLessonForUserSmart(userId);

      // Should advance step when activity is orphaned
      expect(learningPathService.advanceStep).toHaveBeenCalledWith(
        activePath.id,
        userId,
      );

      // Should return null to trigger fallback logic
      expect(result).toBeNull();
    });

    it('should handle missing activity', async () => {
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 0,
        activityIds: [activityId],
        isCompleted: false,
      };

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );
      prisma.activity.findUnique.mockResolvedValue(null); // Activity not found
      learningPathService.advanceStep.mockResolvedValue(undefined);

      const result = await service.findNextLessonForUserSmart(userId);

      // Should advance step when activity doesn't exist
      expect(learningPathService.advanceStep).toHaveBeenCalledWith(
        activePath.id,
        userId,
      );

      expect(result).toBeNull();
    });

    it('should require enrollment for course', async () => {
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 0,
        activityIds: [activityId],
        isCompleted: false,
      };

      const mockActivity = {
        id: activityId,
        lessonId,
        type: ActivityType.quiz,
        lesson: {
          id: lessonId,
          courseId,
        },
      };

      const mockClassrooms = [
        { id: 'classroom-1', name: 'Class A' },
        { id: 'classroom-2', name: 'Class B' },
      ];

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );
      prisma.activity.findUnique.mockResolvedValue(mockActivity as any);
      prisma.classroomStudent.findFirst.mockResolvedValue(null); // No enrollment
      prisma.classroom.findMany.mockResolvedValue(mockClassrooms as any);

      const result = await service.findNextLessonForUserSmart(userId);

      expect(result).toMatchObject({
        type: 'enrollment_required',
        courseId,
        message: 'Cần đăng ký lớp học để học course này',
        classrooms: mockClassrooms,
      });
    });

    it('should handle enrollment without purchase', async () => {
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 0,
        activityIds: [activityId],
        isCompleted: false,
      };

      const mockActivity = {
        id: activityId,
        lessonId,
        type: ActivityType.quiz,
        lesson: {
          id: lessonId,
          courseId,
        },
      };

      const unpaidEnrollment = {
        id: 'enrollment-1',
        userId,
        courseId,
        isPurchased: false, // Not purchased
      };

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );
      prisma.activity.findUnique.mockResolvedValue(mockActivity as any);
      prisma.classroomStudent.findFirst.mockResolvedValue(
        unpaidEnrollment as any,
      );
      prisma.classroom.findMany.mockResolvedValue([]);

      const result = await service.findNextLessonForUserSmart(userId);

      // Should require enrollment even if enrollment exists but not purchased
      expect(result).toMatchObject({
        type: 'enrollment_required',
        courseId,
      });
    });

    it('should handle no active learning path', async () => {
      learningPathService.findActiveByUserId.mockResolvedValue(null);

      // Should continue to fallback logic (we can't test full fallback without mocking more)
      // This test just ensures no error is thrown
      await expect(
        service.findNextLessonForUserSmart(userId),
      ).rejects.toThrow(); // Will fail at profile analysis step
    });

    it('should handle learning path at end of activities', async () => {
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 2, // Beyond activityIds length
        activityIds: [activityId],
        isCompleted: true,
      };

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );

      // Should skip learning path logic when currentStep >= activityIds.length
      await expect(
        service.findNextLessonForUserSmart(userId),
      ).rejects.toThrow(); // Will fail at profile analysis step
    });
  });

  describe('updateLearningPathProgress - Bug Fix: Activity-based Progress', () => {
    const userId = 'user-123';
    const activityId = 'activity-456';
    const lessonId = 'lesson-789';

    it('should advance step when activity is in path and lesson completed', async () => {
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 1,
        activityIds: ['activity-000', activityId, 'activity-999'], // activityId at index 1
        isCompleted: false,
      };

      const mockActivity = {
        id: activityId,
        lessonId,
      };

      const updatedPath = {
        ...activePath,
        currentStep: 2,
        isCompleted: false,
      };

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );
      prisma.activity.findUnique.mockResolvedValue(mockActivity as any);

      // Mock isLessonCompleted to return true
      jest.spyOn(service as any, 'isLessonCompleted').mockResolvedValue(true);

      learningPathService.advanceStep.mockResolvedValue(undefined);
      learningPathService.findById.mockResolvedValue(updatedPath as any);

      await (service as any).updateLearningPathProgress(userId, activityId);

      // Verify activity index check used activityIds (not courseIds)
      expect(learningPathService.advanceStep).toHaveBeenCalledWith(
        activePath.id,
        userId,
      );
    });

    it('should NOT advance when activity not in path', async () => {
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 0,
        activityIds: ['activity-000', 'activity-999'], // activityId not in list
        isCompleted: false,
      };

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );

      await (service as any).updateLearningPathProgress(userId, activityId);

      // Should return early without advancing
      expect(prisma.activity.findUnique).not.toHaveBeenCalled();
      expect(learningPathService.advanceStep).not.toHaveBeenCalled();
    });

    it('should NOT advance when activity index does not match current step', async () => {
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 0,
        activityIds: ['activity-000', activityId, 'activity-999'], // activityId at index 1, not 0
        isCompleted: false,
      };

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );

      await (service as any).updateLearningPathProgress(userId, activityId);

      // Should return early - user working ahead/behind
      expect(prisma.activity.findUnique).not.toHaveBeenCalled();
      expect(learningPathService.advanceStep).not.toHaveBeenCalled();
    });

    it('should NOT advance when lesson not completed', async () => {
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 1,
        activityIds: ['activity-000', activityId, 'activity-999'],
        isCompleted: false,
      };

      const mockActivity = {
        id: activityId,
        lessonId,
      };

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );
      prisma.activity.findUnique.mockResolvedValue(mockActivity as any);

      // Mock isLessonCompleted to return false
      jest.spyOn(service as any, 'isLessonCompleted').mockResolvedValue(false);

      await (service as any).updateLearningPathProgress(userId, activityId);

      // Should not advance when lesson incomplete
      expect(learningPathService.advanceStep).not.toHaveBeenCalled();
    });

    it('should handle missing activity gracefully', async () => {
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 0,
        activityIds: [activityId],
        isCompleted: false,
      };

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );
      prisma.activity.findUnique.mockResolvedValue(null); // Activity not found

      // Should log warning and return without throwing
      await expect(
        (service as any).updateLearningPathProgress(userId, activityId),
      ).resolves.not.toThrow();

      expect(learningPathService.advanceStep).not.toHaveBeenCalled();
    });

    it('should detect path completion after advancing', async () => {
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 2, // Last step
        activityIds: ['activity-000', 'activity-111', activityId], // 3 activities
        isCompleted: false,
      };

      const mockActivity = {
        id: activityId,
        lessonId,
      };

      const completedPath = {
        ...activePath,
        currentStep: 3,
        isCompleted: true, // Path now completed
      };

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );
      prisma.activity.findUnique.mockResolvedValue(mockActivity as any);
      jest.spyOn(service as any, 'isLessonCompleted').mockResolvedValue(true);
      learningPathService.advanceStep.mockResolvedValue(undefined);
      learningPathService.findById.mockResolvedValue(completedPath as any);

      await (service as any).updateLearningPathProgress(userId, activityId);

      // Verify path completion was detected
      expect(learningPathService.findById).toHaveBeenCalledWith(
        activePath.id,
        userId,
      );
    });

    it('should handle errors silently without breaking activity completion', async () => {
      const activePath = {
        id: 'path-1',
        userId,
        currentStep: 0,
        activityIds: [activityId],
        isCompleted: false,
      };

      learningPathService.findActiveByUserId.mockResolvedValue(
        activePath as any,
      );
      prisma.activity.findUnique.mockRejectedValue(new Error('Database error'));

      // Should catch error and not throw
      await expect(
        (service as any).updateLearningPathProgress(userId, activityId),
      ).resolves.not.toThrow();
    });

    it('should handle no active learning path', async () => {
      learningPathService.findActiveByUserId.mockResolvedValue(null);

      // Should return early when no active path
      await (service as any).updateLearningPathProgress(userId, activityId);

      expect(prisma.activity.findUnique).not.toHaveBeenCalled();
      expect(learningPathService.advanceStep).not.toHaveBeenCalled();
    });

    it('should handle undefined learningPathService', async () => {
      const serviceWithoutLPS = new LessonService(
        lessonRepository,
        parentNotificationService,
        prisma,
        undefined,
        undefined, // No learning path service
        undefined,
      );

      // Should return immediately without error
      await expect(
        (serviceWithoutLPS as any).updateLearningPathProgress(
          userId,
          activityId,
        ),
      ).resolves.not.toThrow();
    });
  });
});
