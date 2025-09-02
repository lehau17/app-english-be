import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { Activity, Prisma } from '@prisma/client';
import {
  CreateActivityDto,
  FilterActivityRequestDto,
} from '../dto/activity.dto';

@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async create(data: CreateActivityDto): Promise<Activity> {
    return this.prisma.activity.create({ data });
  }

  async findById(id: string): Promise<Activity | null> {
    return this.prisma.activity.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: Prisma.ActivityUpdateInput,
  ): Promise<Activity> {
    return this.prisma.activity.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Activity> {
    return this.prisma.activity.delete({ where: { id } });
  }

  async list(
    params: FilterActivityRequestDto,
  ): Promise<PageResponseDto<Activity>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'orderNo',
      sortOrder = 'asc',
      lessonId,
      type,
    } = params;

    const where: Prisma.ActivityWhereInput = {
      lessonId,
      type,
      OR: search
        ? [{ content: { array_contains: search, mode: 'insensitive' } }]
        : undefined,
    };

    const totalItems = await this.prisma.activity.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const data = await this.prisma.activity.findMany({
      where,
      skip: (safePage - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

    return PageResponseDto.of(data, safePage, limit, totalItems);
  }
}
