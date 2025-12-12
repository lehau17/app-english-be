import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LearningPath } from '@prisma/client';
import { CreateLearningPathDto, UpdateLearningPathDto } from '../dto';
import { LearningPathRepository } from '../repository/learning-path.repository';

@Injectable()
export class LearningPathService {
  constructor(private readonly repository: LearningPathRepository) {}

  async create(
    userId: string,
    dto: CreateLearningPathDto,
  ): Promise<LearningPath> {
    // Validate activityIds exist
    await this.validateActivities(dto.activityIds);

    return this.repository.create(userId, dto);
  }

  async findByUserId(
    userId: string,
    filters?: { isCompleted?: boolean },
  ): Promise<LearningPath[]> {
    return this.repository.findByUserId(userId, filters);
  }

  async findById(id: string, userId: string): Promise<LearningPath> {
    const path = await this.repository.findById(id);
    if (!path) {
      throw new NotFoundException(`Learning path with id ${id} not found`);
    }
    if (path.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this learning path',
      );
    }
    return path;
  }

  async findActiveByUserId(userId: string): Promise<LearningPath | null> {
    return this.repository.findActiveByUserId(userId);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateLearningPathDto,
  ): Promise<LearningPath> {
    await this.findById(id, userId); // Check ownership

    if (dto.activityIds) {
      await this.validateActivities(dto.activityIds);
    }

    return this.repository.update(id, dto);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findById(id, userId); // Check ownership
    await this.repository.delete(id);
  }

  async advanceStep(id: string, userId: string): Promise<LearningPath> {
    await this.findById(id, userId); // Check ownership
    return this.repository.advanceStep(id);
  }

  async getProgress(id: string, userId: string) {
    await this.findById(id, userId); // Check ownership
    return this.repository.getProgress(id, userId);
  }

  private async validateActivities(activityIds: string[]): Promise<void> {
    // TODO: Validate activities exist
    // const activities = await this.activityRepository.findByIds(activityIds);
    // if (activities.length !== activityIds.length) {
    //   throw new BadRequestException('Some activities not found');
    // }
  }
}
