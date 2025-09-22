import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';

import {
  CreatePodcastRatingDto
} from './podcast-rating.dto';

@Injectable()
export class PodcastRatingService {
  constructor(private readonly prisma: PrismaRepository) {}

  async createOrUpdate(userId: string, payload: CreatePodcastRatingDto) {
    const existing = await this.prisma.podcastRating.findFirst({
      where: { userId, podcastId: payload.podcastId },
    });

    if (existing) {
      const updated = await this.prisma.podcastRating.update({
        where: { id: existing.id },
        data: {
          overallRating: payload.overallRating,
          difficultyRating: payload.difficultyRating,
          qualityRating: payload.qualityRating,
        },
      });
      return updated;
    }

    const created = await this.prisma.podcastRating.create({
      data: {
        userId,
        podcastId: payload.podcastId,
        overallRating: payload.overallRating,
        difficultyRating: payload.difficultyRating,
        qualityRating: payload.qualityRating,
      },
    });
    return created;
  }

  async getByUserAndPodcast(userId: string, podcastId: string) {
    return this.prisma.podcastRating.findFirst({
      where: { userId, podcastId },
    });
  }

  async getAggregatedForPodcast(podcastId: string) {
    // compute average and counts
    const ratings = await this.prisma.podcastRating.findMany({
      where: { podcastId },
      select: {
        overallRating: true,
        difficultyRating: true,
        qualityRating: true,
      },
    });

    if (!ratings.length) {
      return {
        averageOverall: null,
        averageDifficulty: null,
        averageQuality: null,
        total: 0,
      };
    }

    const total = ratings.length;
    const sumOverall = ratings.reduce((s, r) => s + (r.overallRating ?? 0), 0);
    const sumDiff = ratings.reduce((s, r) => s + (r.difficultyRating ?? 0), 0);
    const sumQuality = ratings.reduce((s, r) => s + (r.qualityRating ?? 0), 0);

    return {
      averageOverall: +(sumOverall / total).toFixed(2),
      averageDifficulty: +(sumDiff / total).toFixed(2),
      averageQuality: +(sumQuality / total).toFixed(2),
      total,
    };
  }

  async deleteRating(userId: string, podcastId: string) {
    const existing = await this.prisma.podcastRating.findFirst({
      where: { userId, podcastId },
    });
    if (!existing) return null;
    return this.prisma.podcastRating.delete({ where: { id: existing.id } });
  }

  async listRatings(podcastId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.podcastRating.findMany({
        where: { podcastId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              firstName: true,
              lastName: true
            },
          },
        },
      }),
      this.prisma.podcastRating.count({ where: { podcastId } }),
    ]);

    return { data, total };
  }

  async hasUserRated(userId: string, podcastId: string) {
    const existing = await this.prisma.podcastRating.findFirst({ where: { userId, podcastId } });
    return existing;
  }
}
