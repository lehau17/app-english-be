import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@app/database';
import { Topic, Prisma } from '@prisma/client';
import {
  TopicFilterDto,
  CreateTopicDto,
  UpdateTopicDto,
} from '../dto/topic.dto';

@Injectable()
export class TopicsRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async findAll(filters?: TopicFilterDto): Promise<Topic[]> {
    const where: Prisma.TopicWhereInput = {};

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.difficulty) {
      where.difficulty = filters.difficulty;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured;
    }

    if (filters?.trending) {
      // Trending topics: usageCount >= 5 AND trendScore >= 120
      where.AND = [{ usageCount: { gte: 5 } }, { trendScore: { gte: 120 } }];
    }

    return this.prisma.topic.findMany({
      where,
      orderBy: [
        { isFeatured: 'desc' },
        { trendScore: 'desc' },
        { usageCount: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async findById(id: string): Promise<Topic | null> {
    return this.prisma.topic.findUnique({
      where: { id },
    });
  }

  async findByName(name: string): Promise<Topic | null> {
    return this.prisma.topic.findUnique({
      where: { name },
    });
  }

  async create(data: CreateTopicDto): Promise<Topic> {
    return this.prisma.topic.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        difficulty: data.difficulty,
        isActive: data.isActive ?? true,
        isFeatured: data.isFeatured ?? false,
      },
    });
  }

  async update(id: string, data: UpdateTopicDto): Promise<Topic> {
    return this.prisma.topic.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Topic> {
    return this.prisma.topic.delete({
      where: { id },
    });
  }

  async incrementUsageCount(id: string): Promise<Topic> {
    return this.prisma.topic.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });
  }

  async createUsage(data: { topicId: string; userId: string }): Promise<void> {
    await this.prisma.topicUsage.create({
      data,
    });
  }

  async countUsageSince(topicId: string, since: Date): Promise<number> {
    return this.prisma.topicUsage.count({
      where: {
        topicId,
        createdAt: { gte: since },
      },
    });
  }

  async getUserTopicUsage(userId: string, topicId: string): Promise<number> {
    return this.prisma.topicUsage.count({
      where: { userId, topicId },
    });
  }
}
