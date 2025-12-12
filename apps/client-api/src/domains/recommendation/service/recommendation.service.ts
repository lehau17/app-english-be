import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { RecommendationRepository } from '../repository/recommendation.repository';
import { CreateRecommendationDto } from '../dto';
import { Recommendation } from '@prisma/client';

@Injectable()
export class RecommendationService {
  constructor(private readonly repository: RecommendationRepository) {}

  async create(dto: CreateRecommendationDto): Promise<Recommendation> {
    return this.repository.create(dto);
  }

  async findByUserId(
    userId: string,
    filters?: {
      type?: string;
      viewed?: boolean;
      dismissed?: boolean;
    },
  ): Promise<Recommendation[]> {
    return this.repository.findByUserId(userId, filters);
  }

  async findById(id: string, userId: string): Promise<Recommendation> {
    const recommendation = await this.repository.findById(id);
    if (!recommendation) {
      throw new NotFoundException(`Recommendation with id ${id} not found`);
    }
    if (recommendation.userId !== userId) {
      throw new ForbiddenException('You do not have access to this recommendation');
    }
    return recommendation;
  }

  async markAsViewed(id: string, userId: string): Promise<Recommendation> {
    await this.findById(id, userId); // Check ownership
    return this.repository.markAsViewed(id, userId);
  }

  async markAsClicked(id: string, userId: string): Promise<Recommendation> {
    await this.findById(id, userId); // Check ownership
    return this.repository.markAsClicked(id, userId);
  }

  async dismiss(id: string, userId: string): Promise<Recommendation> {
    await this.findById(id, userId); // Check ownership
    return this.repository.dismiss(id, userId);
  }
}



