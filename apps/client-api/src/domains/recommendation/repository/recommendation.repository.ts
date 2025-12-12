import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@app/database';
import { Recommendation } from '@prisma/client';
import { CreateRecommendationDto } from '../dto';

@Injectable()
export class RecommendationRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async create(dto: CreateRecommendationDto): Promise<Recommendation> {
    return this.prisma.recommendation.create({
      data: dto,
    });
  }

  async findById(id: string): Promise<Recommendation | null> {
    return this.prisma.recommendation.findUnique({
      where: { id },
    });
  }

  async findByUserId(
    userId: string,
    filters?: {
      type?: string;
      viewed?: boolean;
      dismissed?: boolean;
    },
  ): Promise<Recommendation[]> {
    return this.prisma.recommendation.findMany({
      where: {
        userId,
        ...(filters?.type && { type: filters.type }),
        ...(filters?.viewed !== undefined && { viewed: filters.viewed }),
        ...(filters?.dismissed !== undefined && {
          dismissed: filters.dismissed,
        }),
        expiresAt: { gte: new Date() }, // Only non-expired
      },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async markAsViewed(id: string, userId: string): Promise<Recommendation> {
    return this.prisma.recommendation.update({
      where: {
        id,
        userId, // Ensure ownership
      },
      data: { viewed: true },
    });
  }

  async markAsClicked(id: string, userId: string): Promise<Recommendation> {
    return this.prisma.recommendation.update({
      where: {
        id,
        userId, // Ensure ownership
      },
      data: { clicked: true, viewed: true },
    });
  }

  async dismiss(id: string, userId: string): Promise<Recommendation> {
    return this.prisma.recommendation.update({
      where: {
        id,
        userId, // Ensure ownership
      },
      data: { dismissed: true },
    });
  }
}
