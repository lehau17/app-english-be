import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
    CreateActivityDto,
    GetActivitiesQueryDto,
    UpdateActivityDto,
} from '../dto/podcast-activity.dto';
import { GetAttemptsQueryDto, SubmitAttemptDto } from '../dto/user-activity-attempt.dto';
import { PodcastActivityEntity } from '../entities/podcast-activity.entity';

@Injectable()
export class PodcastActivityService {
  constructor(private readonly prisma: PrismaRepository) {}

  // ===================== ACTIVITY CRUD =====================

  async findByPodcast(podcastId: string, userId: string, query: GetActivitiesQueryDto): Promise<PageResponseDto<any>> {
    const { page = 1, limit = 20, type, includeProgress = false, activeOnly = true } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      podcastId,
      ...(type && { type }),
      ...(activeOnly && { isActive: true }),
    };

    const [activities, total] = await Promise.all([
      this.prisma.podcastActivity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { orderNo: 'asc' },
        include: {
          attempts: includeProgress && userId
            ? {
                where: { userId },
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  score: true,
                  isPassed: true,
                  attemptNo: true,
                  timeSpent: true,
                  answers: true,
                  feedback: true,
                  createdAt: true,
                },
              }
            : false,
          _count: {
            select: {
              attempts: true,
            },
          },
        },
      }),
      this.prisma.podcastActivity.count({ where }),
    ]);

    // Transform response with user progress
    const transformed = activities.map((activity) => {
      const userAttempts = (activity as any).attempts || [];
      const bestAttempt = userAttempts.length > 0
        ? userAttempts.reduce((best: any, current: any) =>
            (current.score || 0) > (best.score || 0) ? current : best
          )
        : null;

      return {
        ...activity,
        attempts: undefined, // Remove from response
        userProgress: includeProgress && userId ? {
          bestScore: bestAttempt?.score,
          isPassed: bestAttempt?.isPassed || false,
          attemptCount: userAttempts.length,
          lastAttempt: bestAttempt?.createdAt,
        } : undefined,
        totalAttempts: (activity as any)._count?.attempts || 0,
      };
    });

    return PageResponseDto.of(transformed, page, limit, total);
  }

  async findOne(id: string, userId: string): Promise<any> {
    const activity = await this.prisma.podcastActivity.findUnique({
      where: { id },
      include: {
        attempts: userId ? {
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            score: true,
            isPassed: true,
            attemptNo: true,
            timeSpent: true,
            answers: true,
            feedback: true,
            createdAt: true,
          },
        } : false,
        _count: {
          select: {
            attempts: true,
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    // Check if user can access this activity
    if (activity.isLocked && userId) {
      const canAccess = await this.checkActivityAccess(activity, userId);
      if (!canAccess) {
        throw new ForbiddenException('Activity is locked. Complete prerequisite activities first.');
      }
    }

    const userAttempts = (activity as any).attempts || [];
    const bestAttempt = userAttempts.length > 0
      ? userAttempts.reduce((best: any, current: any) =>
          (current.score || 0) > (best.score || 0) ? current : best
        )
      : null;

    return {
      ...activity,
      attempts: undefined, // Remove from response
      userProgress: userId ? {
        bestScore: bestAttempt?.score,
        isPassed: bestAttempt?.isPassed || false,
        attemptCount: userAttempts.length,
        lastAttempt: bestAttempt?.createdAt,
      } : undefined,
      totalAttempts: (activity as any)._count.attempts,
    };
  }

  async create(createActivityDto: CreateActivityDto, userId: string): Promise<PodcastActivityEntity> {
    // Check if user owns the podcast
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: createActivityDto.podcastId },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    if (podcast.authorId !== userId) {
      throw new ForbiddenException('You can only create activities for your own podcasts');
    }

    // Get next order number
    const maxOrderActivity = await this.prisma.podcastActivity.findFirst({
      where: { podcastId: createActivityDto.podcastId },
      orderBy: { orderNo: 'desc' },
    });

    const orderNo = maxOrderActivity ? maxOrderActivity.orderNo + 1 : 1;

    const activity = await this.prisma.podcastActivity.create({
      data: {
        title: createActivityDto.title,
        description: createActivityDto.description,
        podcastId: createActivityDto.podcastId,
        type: createActivityDto.type,
        content: createActivityDto.content,
        orderNo,
        timeLimit: createActivityDto.timeLimit,
        points: createActivityDto.points || 10,
      },
    });

    // Update podcast hasActivities flag
    await this.prisma.podcast.update({
      where: { id: createActivityDto.podcastId },
      data: { hasActivities: true },
    });

    return activity as PodcastActivityEntity;
  }

  async update(id: string, updateActivityDto: UpdateActivityDto, userId: string): Promise<PodcastActivityEntity> {
    const activity = await this.prisma.podcastActivity.findUnique({
      where: { id },
      include: {
        podcast: true,
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    if (activity.podcast.authorId !== userId) {
      throw new ForbiddenException('You can only update activities for your own podcasts');
    }

    const updatedActivity = await this.prisma.podcastActivity.update({
      where: { id },
      data: {
        ...(updateActivityDto.title && { title: updateActivityDto.title }),
        ...(updateActivityDto.description !== undefined && { description: updateActivityDto.description }),
        ...(updateActivityDto.type && { type: updateActivityDto.type }),
        ...(updateActivityDto.content && { content: updateActivityDto.content }),
        ...(updateActivityDto.startTime !== undefined && { startTime: updateActivityDto.startTime }),
        ...(updateActivityDto.endTime !== undefined && { endTime: updateActivityDto.endTime }),
        ...(updateActivityDto.points !== undefined && { points: updateActivityDto.points }),
        ...(updateActivityDto.maxAttempts !== undefined && { maxAttempts: updateActivityDto.maxAttempts }),
        ...(updateActivityDto.isRequired !== undefined && { isRequired: updateActivityDto.isRequired }),
        ...(updateActivityDto.status && { status: updateActivityDto.status }),
      },
    });

    return updatedActivity as PodcastActivityEntity;
  }

  async remove(id: string, userId: string): Promise<void> {
    const activity = await this.prisma.podcastActivity.findUnique({
      where: { id },
      include: {
        podcast: true,
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    if (activity.podcast.authorId !== userId) {
      throw new ForbiddenException('You can only delete activities for your own podcasts');
    }

    await this.prisma.podcastActivity.delete({
      where: { id },
    });

    // Check if podcast still has activities
    const remainingActivities = await this.prisma.podcastActivity.count({
      where: { podcastId: activity.podcastId },
    });

    if (remainingActivities === 0) {
      await this.prisma.podcast.update({
        where: { id: activity.podcastId },
        data: { hasActivities: false },
      });
    }
  }

  // ===================== ATTEMPTS =====================

  async submitAttempt(activityId: string, userId: string, submitAttemptDto: SubmitAttemptDto) {
    const activity = await this.prisma.podcastActivity.findUnique({
      where: { id: activityId },
      include: {
        podcast: true,
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    // Calculate percentage score based on answers
    const { correctCount, totalQuestions, scorePercent } =
      await this.evaluateFillBlankAttempt(activity, submitAttemptDto.answers);

    // Get next attempt number
    const lastAttempt = await this.prisma.podcastActivityAttempt.findFirst({
      where: { activityId, userId },
      orderBy: { attemptNo: 'desc' },
    });

    const attemptNo = lastAttempt ? lastAttempt.attemptNo + 1 : 1;

    // Create attempt record with percentage scoring
    const attempt = await this.prisma.podcastActivityAttempt.create({
      data: {
        userId,
        activityId,
        attemptNo,
        correctCount,
        totalQuestions,
        scorePercent,
        timeSpent: submitAttemptDto.timeSpent,
        answers: submitAttemptDto.answers,
      },
    });

    return attempt;
  }

  async getAttempts(activityId: string, userId: string, query: GetAttemptsQueryDto) {
    const { page = 1, limit = 10, sortBy = 'newest' } = query;
    const skip = (page - 1) * limit;

    let orderBy: any = {};
    switch (sortBy) {
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'score':
        orderBy = { score: 'desc' };
        break;
    }

  const [attempts, total] = await Promise.all([
      this.prisma.podcastActivityAttempt.findMany({
        where: { activityId, userId },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.podcastActivityAttempt.count({
        where: { activityId, userId }
      }),
    ]);

  return PageResponseDto.of(attempts as any, page, limit, total);
  }

  // ===================== HELPER METHODS =====================

  private async checkActivityAccess(activity: any, userId: string): Promise<boolean> {
    if (!activity.isLocked) {
      return true;
    }

    if (!activity.unlockAfter) {
      return false; // Locked but no unlock condition specified
    }

    // Check if prerequisite activity is completed
    const prerequisiteAttempt = await this.prisma.podcastActivityAttempt.findFirst({
      where: {
        activityId: activity.unlockAfter,
        userId,
        isPassed: true,
      },
    });

    return !!prerequisiteAttempt;
  }

  private async evaluateFillBlankAttempt(activity: any, answers: Record<string, string>): Promise<{
    correctCount: number;
    totalQuestions: number;
    scorePercent: number;
  }> {
    const content = activity.content;

    if (!content.questions) {
      return { correctCount: 0, totalQuestions: 0, scorePercent: 0 };
    }

    let correctCount = 0;
    const totalQuestions = content.questions.length;

    content.questions.forEach((question: any) => {
      const userAnswer = answers[question.id]?.toLowerCase().trim();
      const correctAnswers = question.correctAnswers.map((ans: string) => ans.toLowerCase().trim());

      if (userAnswer && correctAnswers.includes(userAnswer)) {
        correctCount++;
      }
    });

    const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return {
      correctCount,
      totalQuestions,
      scorePercent,
    };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Very basic similarity calculation - you might want to use a proper algorithm
    if (!text1 || !text2) return 0;

    const words1 = text1.split(' ');
    const words2 = text2.split(' ');

    let matches = 0;
    words1.forEach(word => {
      if (words2.includes(word)) {
        matches++;
      }
    });

    return matches / Math.max(words1.length, words2.length);
  }

  private async updateUserProgress(userId: string, activityId: string, attempt: any) {
    const activity = await this.prisma.podcastActivity.findUnique({
      where: { id: activityId },
      select: { podcastId: true },
    });

    if (!activity) return;

    // Get current progress
    const progress = await this.prisma.userPodcastProgress.findUnique({
      where: {
        userId_podcastId: {
          userId,
          podcastId: activity.podcastId,
        },
      },
    });

    if (!progress) return;

    // Get all activities for this podcast
    const allActivities = await this.prisma.podcastActivity.count({
      where: { podcastId: activity.podcastId, isActive: true },
    });

    // Get user's passed activities
    const passedActivities = await this.prisma.podcastActivityAttempt.groupBy({
      by: ['activityId'],
      where: {
        userId,
        isPassed: true,
        activity: {
          podcastId: activity.podcastId,
          isActive: true,
        },
      },
    });

    // Update progress
    await this.prisma.userPodcastProgress.update({
      where: {
        userId_podcastId: {
          userId,
          podcastId: activity.podcastId,
        },
      },
      data: {
        activitiesCompleted: passedActivities.length,
        totalActivities: allActivities,
        lastListenAt: new Date(),
      },
    });
  }
}
