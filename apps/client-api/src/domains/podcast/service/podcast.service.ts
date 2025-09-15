import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePodcastDto, GetPodcastsQueryDto, UpdatePodcastDto } from '../dto/podcast.dto';
import {
  CreateRatingDto,
  GetRatingsQueryDto,
  ToggleLikeDto,
  ToggleSaveDto,
  UpdateProgressDto,
} from '../dto/user-interaction.dto';
import { PodcastEntity } from '../entities/podcast.entity';

@Injectable()
export class PodcastService {
  constructor(private readonly prisma: PrismaRepository) {}

  // ===================== PODCAST CRUD =====================

  async findAll(userId: string, query: GetPodcastsQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      source,
      difficulty,
      duration,
      sortBy = 'newest',
      sortOrder = 'desc',
      recommended,
      hasActivities,
      premium,
      tab,
    } = query;

    const skip = (page - 1) * limit;
    const where: any = {
      status: 'published',
    };

    // Search
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { storyTitle: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
        { keywords: { has: search } },
      ];
    }

    // Filters
    if (category) where.category = category;
    if (source) where.source = source;
    if (difficulty) where.difficulty = difficulty;
    if (recommended !== undefined) where.isRecommended = recommended;
    if (hasActivities !== undefined) where.hasActivities = hasActivities;
    if (premium !== undefined) where.isPremium = premium;

    // Duration filter
    if (duration) {
      switch (duration) {
        case 'short':
          where.duration = { lt: 600 }; // < 10 minutes
          break;
        case 'medium':
          where.duration = { gte: 600, lte: 1200 }; // 10-20 minutes
          break;
        case 'long':
          where.duration = { gt: 1200 }; // > 20 minutes
          break;
      }
    }

    // Tab filtering with user progress
    if (tab && userId) {
      switch (tab) {
        case 'listening':
          where.userProgress = {
            some: {
              userId,
              isCompleted: false,
              completionRate: { gt: 0 },
            },
          };
          break;
        case 'completed':
          where.userProgress = {
            some: {
              userId,
              isCompleted: true,
            },
          };
          break;
        case 'recommended':
          where.isRecommended = true;
          break;
      }
    }

    // Sorting
    let orderBy: any = {};
    switch (sortBy) {
      case 'newest':
        orderBy = { publishedAt: sortOrder };
        break;
      case 'popular':
        orderBy = { viewCount: sortOrder };
        break;
      case 'duration':
        orderBy = { duration: sortOrder };
        break;
      case 'rating':
        orderBy = { averageRating: sortOrder };
        break;
      case 'title':
        orderBy = { title: sortOrder };
        break;
      default:
        orderBy = { publishedAt: 'desc' };
    }

    const [podcasts, total] = await Promise.all([
      this.prisma.podcast.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          activities: {
            select: {
              id: true,
              type: true,
              isLocked: true,
              isPremium: true,
            },
          },
          userProgress: userId
            ? {
                where: { userId },
                select: {
                  currentPosition: true,
                  completionRate: true,
                  isLiked: true,
                  isSaved: true,
                  isCompleted: true,
                  lastListenAt: true,
                },
              }
            : false,
          author: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.podcast.count({ where }),
    ]);

    // Transform response
    const transformedPodcasts = podcasts.map((podcast) => ({
      ...podcast,
      userProgress: userId && podcast.userProgress?.[0] ? podcast.userProgress[0] : undefined,
      activitiesCount: podcast.activities.length,
      activities: undefined, // Remove activities from main response for performance
    }));

  return PageResponseDto.of(transformedPodcasts as any, page, limit, total);
  }

  async findOne(id: string, userId?: string): Promise<PodcastEntity> {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id },
      include: {
        activities: {
          orderBy: { orderNo: 'asc' },
          include: {
            attempts: userId
              ? {
                  where: { userId },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: {
                    score: true,
                    isPassed: true,
                    createdAt: true,
                  },
                }
              : false,
          },
        },
        userProgress: userId
          ? {
              where: { userId },
            }
          : false,
        author: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        ratings: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            ratings: true,
            comments: true,
          },
        },
      },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    // Increment view count (async, don't wait)
    this.prisma.podcast
      .update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {}); // Ignore errors

    return {
      ...podcast,
      userProgress: userId && podcast.userProgress?.[0] ? podcast.userProgress[0] : undefined,
      totalRatings: podcast._count.ratings,
      totalComments: podcast._count.comments,
    } as any;
  }

  async create(createPodcastDto: CreatePodcastDto, userId: string): Promise<PodcastEntity> {
    const existingPodcast = await this.prisma.podcast.findUnique({
      where: { code: createPodcastDto.code },
    });

    if (existingPodcast) {
      throw new BadRequestException('Podcast code already exists');
    }

    const podcast = await this.prisma.podcast.create({
      data: {
        ...createPodcastDto,
        authorId: userId,
        status: 'draft',
      },
    });

    return podcast as PodcastEntity;
  }

  async update(id: string, updatePodcastDto: UpdatePodcastDto, userId: string): Promise<PodcastEntity> {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    if (podcast.authorId !== userId) {
      throw new ForbiddenException('You can only update your own podcasts');
    }

    const updatedPodcast = await this.prisma.podcast.update({
      where: { id },
      data: updatePodcastDto,
    });

    return updatedPodcast as PodcastEntity;
  }

  async remove(id: string, userId: string): Promise<void> {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    if (podcast.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own podcasts');
    }

    await this.prisma.podcast.delete({
      where: { id },
    });
  }

  // ===================== USER PROGRESS =====================

  async updateProgress(podcastId: string, userId: string, updateProgressDto: UpdateProgressDto) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    const { currentPosition, totalListened, sessionStudyTime } = updateProgressDto;
    const completionRate = (currentPosition / podcast.duration) * 100;
    const isCompleted = completionRate >= 95; // 95% = completed

    const progress = await this.prisma.userPodcastProgress.upsert({
      where: {
        userId_podcastId: {
          userId,
          podcastId,
        },
      },
      update: {
        currentPosition,
        totalListened: totalListened ? { increment: totalListened } : undefined,
        completionRate,
        isCompleted,
        lastListenAt: new Date(),
        sessionCount: { increment: 1 },
        totalStudyTime: sessionStudyTime ? { increment: sessionStudyTime } : undefined,
        completedAt: isCompleted && new Date(),
      },
      create: {
        userId,
        podcastId,
        currentPosition,
        totalListened: totalListened || 0,
        completionRate,
        isCompleted,
        totalStudyTime: sessionStudyTime || 0,
        completedAt: isCompleted ? new Date() : undefined,
      },
    });

    return progress;
  }

  async toggleLike(podcastId: string, userId: string, toggleLikeDto: ToggleLikeDto) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    const progress = await this.prisma.userPodcastProgress.upsert({
      where: {
        userId_podcastId: {
          userId,
          podcastId,
        },
      },
      update: {
        isLiked: toggleLikeDto.isLiked,
        lastListenAt: new Date(),
      },
      create: {
        userId,
        podcastId,
        isLiked: toggleLikeDto.isLiked,
      },
    });

    // Update podcast like count
    await this.prisma.podcast.update({
      where: { id: podcastId },
      data: {
        likeCount: {
          [toggleLikeDto.isLiked ? 'increment' : 'decrement']: 1,
        },
      },
    });

    return progress;
  }

  async toggleSave(podcastId: string, userId: string, toggleSaveDto: ToggleSaveDto) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    const progress = await this.prisma.userPodcastProgress.upsert({
      where: {
        userId_podcastId: {
          userId,
          podcastId,
        },
      },
      update: {
        isSaved: toggleSaveDto.isSaved,
        lastListenAt: new Date(),
      },
      create: {
        userId,
        podcastId,
        isSaved: toggleSaveDto.isSaved,
      },
    });

    // Update podcast save count
    await this.prisma.podcast.update({
      where: { id: podcastId },
      data: {
        saveCount: {
          [toggleSaveDto.isSaved ? 'increment' : 'decrement']: 1,
        },
      },
    });

    return progress;
  }

  // ===================== RATINGS =====================

  async createRating(podcastId: string, userId: string, createRatingDto: CreateRatingDto) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
    });

    if (!podcast) {
      throw new NotFoundException('Podcast not found');
    }

    const rating = await this.prisma.podcastRating.upsert({
      where: {
        userId_podcastId: {
          userId,
          podcastId,
        },
      },
      update: {
        overallRating: createRatingDto.overallRating,
        difficultyRating: createRatingDto.difficultyRating ?? 3,
        qualityRating: createRatingDto.qualityRating ?? 3,
        comment: createRatingDto.review,
        title: createRatingDto.title,
      },
      create: {
        overallRating: createRatingDto.overallRating,
        difficultyRating: createRatingDto.difficultyRating ?? 0,
        qualityRating: createRatingDto.qualityRating ?? 0,
        comment: createRatingDto.review,
        title: createRatingDto.title,
        user: {
          connect: { id: userId },
        },
        podcast: {
          connect: { id: podcastId },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update podcast ratings cache
    await this.updatePodcastRatingsCache(podcastId);

    return rating;
  }

  async getRatings(podcastId: string, query: GetRatingsQueryDto) {
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
      case 'rating':
        orderBy = { overallRating: 'desc' };
        break;
      case 'helpful':
        orderBy = { helpfulCount: 'desc' };
        break;
    }

    const [ratings, total] = await Promise.all([
      this.prisma.podcastRating.findMany({
        where: { podcastId },
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.podcastRating.count({ where: { podcastId } }),
    ]);

  return PageResponseDto.of(ratings as any, page, limit, total);
  }

  private async updatePodcastRatingsCache(podcastId: string) {
    const stats = await this.prisma.podcastRating.aggregate({
      where: { podcastId },
      _avg: {
        overallRating: true,
        difficultyRating: true,
        qualityRating: true,
      },
      _count: {
        id: true,
      },
    });

    await this.prisma.podcast.update({
      where: { id: podcastId },
      data: {
        averageRating: stats._avg.overallRating,
        difficultyRating: stats._avg.difficultyRating,
        qualityRating: stats._avg.qualityRating,
        totalRatings: stats._count.id,
      },
    });
  }

  // ===================== ANALYTICS =====================

  async getPopularPodcasts(limit = 10) {
    return this.prisma.podcast.findMany({
      where: { status: 'published' },
      orderBy: { viewCount: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        code: true,
        viewCount: true,
        likeCount: true,
        averageRating: true,
        category: true,
        difficulty: true,
        duration: true,
        thumbnailUrl: true,
      },
    });
  }

  async getRecommendedForUser(userId: string, limit = 10) {
    // Simple recommendation based on user's liked categories and difficulty
    const userStats = await this.prisma.userPodcastProgress.findMany({
      where: {
        userId,
        isLiked: true,
      },
      include: {
        podcast: {
          select: {
            category: true,
            difficulty: true,
          },
        },
      },
    });

    const preferredCategories = [...new Set(userStats.map(s => s.podcast.category))];
    const preferredDifficulties = [...new Set(userStats.map(s => s.podcast.difficulty))];

    return this.prisma.podcast.findMany({
      where: {
        status: 'published',
        OR: [
          { category: { in: preferredCategories } },
          { difficulty: { in: preferredDifficulties } },
          { isRecommended: true },
        ],
        NOT: {
          userProgress: {
            some: {
              userId,
              isCompleted: true,
            },
          },
        },
      },
      orderBy: [
        { isRecommended: 'desc' },
        { averageRating: 'desc' },
        { viewCount: 'desc' },
      ],
      take: limit,
    });
  }
}
