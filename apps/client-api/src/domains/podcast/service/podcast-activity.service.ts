import { PrismaRepository } from '@app/database';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  async findByPodcast(podcastId: string, userId: string, query: GetActivitiesQueryDto) {
    const { type, includeProgress = false, activeOnly = true } = query;

    const where: any = {
      podcastId,
      ...(type && { type }),
      ...(activeOnly && { isActive: true }),
    };

    const activities = await this.prisma.podcastActivity.findMany({
      where,
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
    });

    // Transform response with user progress
    return activities.map(activity => {
      const userAttempts = activity.attempts || [];
      const bestAttempt = userAttempts.length > 0
        ? userAttempts.reduce((best, current) =>
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
        totalAttempts: activity._count.attempts,
      };
    });
  }

  async findOne(id: string, userId?: string): Promise<PodcastActivityEntity> {
    const activity = await this.prisma.podcastActivity.findUnique({
      where: { id },
      include: {
        podcast: {
          select: {
            id: true,
            title: true,
            code: true,
            isPremium: true,
          },
        },
        attempts: userId
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

    const userAttempts = activity.attempts || [];
    const bestAttempt = userAttempts.length > 0
      ? userAttempts.reduce((best, current) =>
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
      totalAttempts: activity._count.attempts,
    } as any;
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

    // Check if orderNo already exists
    const existingActivity = await this.prisma.podcastActivity.findFirst({
      where: {
        podcastId: createActivityDto.podcastId,
        orderNo: createActivityDto.orderNo,
      },
    });

    if (existingActivity) {
      throw new BadRequestException('Activity order number already exists');
    }

    const activity = await this.prisma.podcastActivity.create({
      data: createActivityDto,
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
      data: updateActivityDto,
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

    // Check if user can access this activity
    if (activity.isLocked) {
      const canAccess = await this.checkActivityAccess(activity, userId);
      if (!canAccess) {
        throw new ForbiddenException('Activity is locked. Complete prerequisite activities first.');
      }
    }

    // Check if user has exceeded max attempts
    if (activity.maxAttempts) {
      const attemptCount = await this.prisma.podcastActivityAttempt.count({
        where: {
          activityId,
          userId,
        },
      });

      if (attemptCount >= activity.maxAttempts) {
        throw new BadRequestException('Maximum attempts exceeded');
      }
    }

    // Calculate score based on activity type and answers
    const { score, isCorrect, feedback, strengths, weaknesses, suggestions } =
      await this.evaluateAttempt(activity, submitAttemptDto.answers);

    const isPassed = activity.passingScore ? score >= activity.passingScore : isCorrect;

    // Get next attempt number
    const lastAttempt = await this.prisma.podcastActivityAttempt.findFirst({
      where: { activityId, userId },
      orderBy: { attemptNo: 'desc' },
    });

    const attemptNo = lastAttempt ? lastAttempt.attemptNo + 1 : 1;

    // Create attempt record
    const attempt = await this.prisma.podcastActivityAttempt.create({
      data: {
        userId,
        activityId,
        attemptNo,
        score,
        isCorrect,
        isPassed,
        timeSpent: submitAttemptDto.timeSpent,
        answers: submitAttemptDto.answers,
        feedback,
        strengths,
        weaknesses,
        suggestions,
      },
    });

    // Update user progress if this is the best attempt
    await this.updateUserProgress(userId, activityId, attempt);

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

    return {
      data: attempts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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

  private async evaluateAttempt(activity: any, answers: any): Promise<{
    score: number;
    isCorrect: boolean;
    feedback: any;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  }> {
    // This is a simplified evaluation - in a real implementation,
    // you would have specific evaluation logic for each activity type

    const content = activity.content;
    let score = 0;
    let correctCount = 0;
    let totalQuestions = 0;
    const feedback: any = {};
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];

    switch (activity.type) {
      case 'quick_quiz':
        if (content.questions) {
          totalQuestions = content.questions.length;
          content.questions.forEach((question: any, index: number) => {
            const userAnswer = answers[`question_${index}`];
            const isCorrect = userAnswer === question.correctAnswer;

            if (isCorrect) {
              correctCount++;
            }

            feedback[`question_${index}`] = {
              correct: isCorrect,
              userAnswer,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
            };
          });

          score = Math.round((correctCount / totalQuestions) * 100);
        }
        break;

      case 'dictation':
        // Simple text similarity scoring
        const originalText = content.text?.toLowerCase() || '';
        const userText = answers.text?.toLowerCase() || '';

        // Very basic similarity calculation
        const similarity = this.calculateTextSimilarity(originalText, userText);
        score = Math.round(similarity * 100);

        feedback.similarity = similarity;
        feedback.originalText = originalText;
        feedback.userText = userText;
        break;

      default:
        // Default scoring - could be enhanced per activity type
        score = Math.random() * 100; // Placeholder
    }

    // Add strengths and weaknesses based on score
    if (score >= 80) {
      strengths.push('Excellent understanding');
    } else if (score >= 60) {
      strengths.push('Good comprehension');
      suggestions.push('Practice similar exercises to improve');
    } else {
      weaknesses.push('Needs more practice');
      suggestions.push('Review the content again');
      suggestions.push('Try easier exercises first');
    }

    return {
      score,
      isCorrect: score >= (activity.passingScore || 60),
      feedback,
      strengths,
      weaknesses,
      suggestions,
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
    const passedActivities = await this.prisma.podcastActivityAttempt.count({
      where: {
        userId,
        isPassed: true,
        activity: {
          podcastId: activity.podcastId,
          isActive: true,
        },
      },
      distinct: ['activityId'],
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
        activitiesCompleted: passedActivities,
        totalActivities: allActivities,
        lastListenAt: new Date(),
      },
    });
  }
}
