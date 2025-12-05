import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { Podcast, Prisma } from '@prisma/client';
import { GetPodcastsQueryDto } from '../dto/podcast.dto';

type PodcastListResult = {
  items: Podcast[];
  total: number;
};

@Injectable()
export class PodcastRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async findAll(
    userId: string,
    query: GetPodcastsQueryDto,
  ): Promise<PodcastListResult> {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      source,
      difficulty,
      duration,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      recommended,
      premium,
      tab,
    } = query;

    const skip = (page - 1) * limit;

    // Build base filter conditions
    const baseConditions: Prisma.PodcastWhereInput = {};

    if (search) {
      baseConditions.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { transcript: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) baseConditions.category = category;
    // if (source) baseConditions.source = source;
    if (difficulty) baseConditions.difficulty = difficulty;
    if (recommended !== undefined) (baseConditions as any).isRecommended = recommended;
    if (premium !== undefined) (baseConditions as any).isPremium = premium;

    if (duration) {
      switch (duration) {
        case 'short':
          baseConditions.duration = { lt: 600 };
          break;
        case 'medium':
          baseConditions.duration = { gte: 600, lte: 1200 };
          break;
        case 'long':
          baseConditions.duration = { gt: 1200 };
          break;
      }
    }

    // Handle visibility filter: show public podcasts OR user's own podcasts
    const visibilityFilter: Prisma.PodcastWhereInput = {
      OR: [
        { isPublic: true },
        { authorId: userId },
      ],
    };

    // Initialize where clause
    const where: Prisma.PodcastWhereInput = {};

    // Apply tab-specific filters and combine with base conditions and visibility
    if (tab && userId) {
      switch (tab) {
        case 'my-podcasts':
          // Show only user's podcasts (no visibility filter needed)
          baseConditions.authorId = userId;
          Object.assign(where, baseConditions);
          break;
        case 'listening':
          baseConditions.attempts = {
            some: {
              userId,
              status: 'in_progress',
            },
          };
          where.AND = [baseConditions, visibilityFilter];
          break;
        case 'completed':
          baseConditions.attempts = {
            some: {
              userId,
              status: 'completed',

            },
          };
          where.AND = [baseConditions, visibilityFilter];
          break;
        case 'recommended':
          (baseConditions as any).isRecommended = true;
          where.AND = [baseConditions, visibilityFilter];
          break;
        default:
          // For 'all' or unknown tabs, apply visibility filter
          where.AND = [baseConditions, visibilityFilter];
          break;
      }
    } else {
      // No tab specified, apply visibility filter
      where.AND = [baseConditions, visibilityFilter];
    }

    let orderBy: Prisma.PodcastOrderByWithRelationInput;
    switch (sortBy) {
      case 'newest':
        orderBy = { createdAt: sortOrder };
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
        orderBy = { createdAt: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.podcast.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
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

    return { items, total };
  }

  async findById(id: string) {
    return this.prisma.podcast.findUnique({
      where: { id },
      include: {
        gaps: {
          orderBy: { orderNo: 'asc' },
        },
        author: {
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
  }

  async createPodcast(data: Prisma.PodcastCreateInput) {
    return this.prisma.podcast.create({
      data,
      include: {
        gaps: true,
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async updatePodcast(id: string, data: Prisma.PodcastUpdateInput) {
    return this.prisma.podcast.update({
      where: { id },
      data,
    });
  }

  async deletePodcast(id: string) {
    return this.prisma.podcast.delete({
      where: { id },
    });
  }

  async upsertRating(payload: Prisma.PodcastRatingUpsertArgs) {
    return this.prisma.podcastRating.upsert(payload);
  }

  async listRatings(args: Prisma.PodcastRatingFindManyArgs) {
    return this.prisma.podcastRating.findMany(args);
  }

  async countRatings(podcastId: string) {
    return this.prisma.podcastRating.count({ where: { podcastId } });
  }

  async aggregatePodcastRating(podcastId: string) {
    return this.prisma.podcastRating.aggregate({
      where: { podcastId },
      _avg: {
        overallRating: true,
        difficultyRating: true,
        qualityRating: true,
      },
      _count: { _all: true },
    });
  }

  async createAttempt(data: Prisma.PodcastAttemptCreateInput) {
    return this.prisma.podcastAttempt.create({ data });
  }

  async findAttemptById(id: string) {
    return this.prisma.podcastAttempt.findUnique({ where: { id } });
  }

  async updateAttempt(id: string, data: Prisma.PodcastAttemptUpdateInput) {
    return this.prisma.podcastAttempt.update({ where: { id }, data });
  }

  async listAttempts(podcastId: string, userId: string) {
    return this.prisma.podcastAttempt.findMany({
      where: { podcastId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
