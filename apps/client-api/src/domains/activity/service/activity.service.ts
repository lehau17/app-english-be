import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Activity } from '@prisma/client';
import {
  CreateActivityDto,
  FilterActivityRequestDto,
  UpdateActivityDto,
} from '../dto/activity.dto';
import { ActivityRepository } from '../repository/activity.repository';

@Injectable()
export class ActivityService {
  constructor(private readonly activityRepository: ActivityRepository) {}

  async create(dto: CreateActivityDto): Promise<Activity> {
    return this.activityRepository.create(dto);
  }

  async findById(id: string): Promise<Activity & { classroomId?: string }> {
    const activity = await this.activityRepository.findById(id);
    if (!activity) {
      throw new NotFoundException(`Activity with id ${id} not found`);
    }

    // Extract classroomId from nested relations
    const classroomId =
      (activity as any)?.lesson?.course?.classrooms?.[0]?.id || null;

    // Return activity with classroomId
    return {
      ...activity,
      classroomId,
    };
  }

  async update(id: string, dto: UpdateActivityDto): Promise<Activity> {
    await this.ensureExists(id);
    return this.activityRepository.update(id, dto);
  }

  async delete(id: string): Promise<Activity> {
    await this.ensureExists(id);
    return this.activityRepository.delete(id);
  }

  async list(
    params: FilterActivityRequestDto,
  ): Promise<PageResponseDto<Activity>> {
    return this.activityRepository.list(params);
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.activityRepository.findById(id);
    if (!exists) {
      throw new NotFoundException(`Activity with id ${id} not found`);
    }
  }
}
