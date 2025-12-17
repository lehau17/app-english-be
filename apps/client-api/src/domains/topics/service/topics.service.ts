import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { RedisService } from '@app/shared/redis';
import { TopicsRepository } from '../repository/topics.repository';
import {
  CreateTopicDto,
  UpdateTopicDto,
  TopicFilterDto,
  TopicResponseDto,
} from '../dto/topic.dto';
import { Topic } from '@prisma/client';

@Injectable()
export class TopicsService {
  private readonly logger = new Logger(TopicsService.name);
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly TRENDING_MIN_USAGE = 5;
  private readonly TRENDING_SCORE_THRESHOLD = 120; // 20% growth

  constructor(
    private readonly repository: TopicsRepository,
    private readonly redis: RedisService,
  ) {}

  async getTopics(filters?: TopicFilterDto): Promise<TopicResponseDto[]> {
    const cacheKey = `topics:list:${JSON.stringify(filters || {})}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for topics: ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn(`Redis get failed: ${error.message}`);
    }

    const topics = await this.repository.findAll(filters);
    const response = topics.map((topic) => this.toResponseDto(topic));

    try {
      await this.redis.set(cacheKey, JSON.stringify(response), this.CACHE_TTL);
    } catch (error) {
      this.logger.warn(`Redis set failed: ${error.message}`);
    }

    return response;
  }

  async getTopicById(id: string): Promise<TopicResponseDto> {
    const cacheKey = `topics:detail:${id}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn(`Redis get failed: ${error.message}`);
    }

    const topic = await this.repository.findById(id);
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${id} not found`);
    }

    const response = this.toResponseDto(topic);

    try {
      await this.redis.set(cacheKey, JSON.stringify(response), this.CACHE_TTL);
    } catch (error) {
      this.logger.warn(`Redis set failed: ${error.message}`);
    }

    return response;
  }

  async createTopic(data: CreateTopicDto): Promise<TopicResponseDto> {
    const existing = await this.repository.findByName(data.name);
    if (existing) {
      throw new ConflictException(
        `Topic with name "${data.name}" already exists`,
      );
    }

    const topic = await this.repository.create(data);
    await this.invalidateCache();

    return this.toResponseDto(topic);
  }

  async updateTopic(
    id: string,
    data: UpdateTopicDto,
  ): Promise<TopicResponseDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Topic with ID ${id} not found`);
    }

    if (data.name && data.name !== existing.name) {
      const nameConflict = await this.repository.findByName(data.name);
      if (nameConflict) {
        throw new ConflictException(
          `Topic with name "${data.name}" already exists`,
        );
      }
    }

    const topic = await this.repository.update(id, data);
    await this.invalidateCache();

    return this.toResponseDto(topic);
  }

  async deleteTopic(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Topic with ID ${id} not found`);
    }

    await this.repository.delete(id);
    await this.invalidateCache();
  }

  async trackUsage(topicId: string, userId: string): Promise<void> {
    const topic = await this.repository.findById(topicId);
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${topicId} not found`);
    }

    await this.repository.createUsage({ topicId, userId });
    await this.repository.incrementUsageCount(topicId);
    await this.invalidateCache();

    this.logger.log(`Tracked usage for topic ${topicId} by user ${userId}`);
  }

  async calculateTrending(): Promise<void> {
    this.logger.log('Starting trending calculation for all topics');

    const topics = await this.repository.findAll({ isActive: true });
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const topic of topics) {
      try {
        const recentUsage = await this.repository.countUsageSince(
          topic.id,
          weekAgo,
        );

        // 4-week baseline
        const baselineUsage = topic.usageCount / 4;

        // Calculate trend score
        const trendScore =
          baselineUsage > 0
            ? (recentUsage / baselineUsage) * 100
            : recentUsage * 10; // For new topics, give higher initial score

        await this.repository.update(topic.id, { trendScore });

        this.logger.debug(
          `Topic ${topic.name}: recent=${recentUsage}, baseline=${baselineUsage.toFixed(2)}, score=${trendScore.toFixed(2)}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to calculate trending for topic ${topic.id}: ${error.message}`,
        );
      }
    }

    await this.invalidateCache();
    this.logger.log('Trending calculation completed');
  }

  isTrending(topic: Topic): boolean {
    return (
      topic.usageCount >= this.TRENDING_MIN_USAGE &&
      topic.trendScore >= this.TRENDING_SCORE_THRESHOLD
    );
  }

  private toResponseDto(topic: Topic): TopicResponseDto {
    return {
      id: topic.id,
      name: topic.name,
      description: topic.description,
      category: topic.category,
      difficulty: topic.difficulty,
      isActive: topic.isActive,
      isFeatured: topic.isFeatured,
      usageCount: topic.usageCount,
      trendScore: topic.trendScore,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
      isTrending: this.isTrending(topic),
    };
  }

  private async invalidateCache(): Promise<void> {
    try {
      const pattern = 'topics:*';
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`Invalidated ${keys.length} cache keys`);
      }
    } catch (error) {
      this.logger.warn(`Cache invalidation failed: ${error.message}`);
    }
  }
}
