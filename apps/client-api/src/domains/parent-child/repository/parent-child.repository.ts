import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { ParentChild, Prisma } from '@prisma/client';
import {
  CreateParentChildDto,
  FilterParentChildRequestDto,
} from '../dto/parent-child.dto';

@Injectable()
export class ParentChildRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async create(data: CreateParentChildDto): Promise<ParentChild> {
    return this.prisma.parentChild.create({ data });
  }

  async findById(
    parentId: string,
    childId: string,
  ): Promise<ParentChild | null> {
    return this.prisma.parentChild.findUnique({
      where: { parentId_childId: { parentId, childId } },
    });
  }

  async delete(parentId: string, childId: string): Promise<ParentChild> {
    return this.prisma.parentChild.delete({
      where: { parentId_childId: { parentId, childId } },
    });
  }

  async list(
    params: FilterParentChildRequestDto,
  ): Promise<PageResponseDto<ParentChild>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      parentId,
      childId,
    } = params;

    const where: Prisma.ParentChildWhereInput = {
      parentId,
      childId,
    };

    const totalItems = await this.prisma.parentChild.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const data = await this.prisma.parentChild.findMany({
      where,
      skip: (safePage - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

    return PageResponseDto.of(data, safePage, limit, totalItems);
  }
  async findManyByParentId(parentId: string): Promise<ParentChild[]> {
    return this.prisma.parentChild.findMany({ where: { parentId } });
  }

  async findManyByChildId(childId: string): Promise<ParentChild[]> {
    return this.prisma.parentChild.findMany({ where: { childId } });
  }
}
