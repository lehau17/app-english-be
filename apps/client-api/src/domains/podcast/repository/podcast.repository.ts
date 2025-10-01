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

    const where: Prisma.PodcastWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { transcript: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) where.category = category;
    if (source) where.source = source;
    if (difficulty) where.difficulty = difficulty;
    if (recommended !== undefined) (where as any).isRecommended = recommended;
    if (premium !== undefined) (where as any).isPremium = premium;

    if (duration) {
      switch (duration) {
        case 'short':
          where.duration = { lt: 600 };
          break;
        case 'medium':
          where.duration = { gte: 600, lte: 1200 };
          break;
        case 'long':
          where.duration = { gt: 1200 };
          break;
      }
    }

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
          (where as any).isRecommended = true;
          break;
      }
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
        gaps: true,
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
