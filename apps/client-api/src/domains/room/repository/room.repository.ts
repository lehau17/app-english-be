import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { Prisma, Room } from '@prisma/client';
import { FilterRoomRequestDto } from '../dto/filter-room.dto';

const ALLOWED_SORT_BY = new Set<keyof Prisma.RoomOrderByWithRelationInput>([
  'createdAt',
  'name',
  'code',
  'capacity',
]);

@Injectable()
export class RoomRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  create(data: Prisma.RoomCreateInput): Promise<Room> {
    return this.prisma.room.create({ data });
  }

  findById(id: string): Promise<Room | null> {
    return this.prisma.room.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.RoomUpdateInput): Promise<Room> {
    return this.prisma.room.update({ where: { id }, data });
  }

  delete(id: string): Promise<Room> {
    return this.prisma.room.delete({ where: { id } });
  }

  async list(params: FilterRoomRequestDto): Promise<PageResponseDto<Room>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isActive,
    } = params;

    const where: Prisma.RoomWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(typeof isActive === 'boolean' && { isActive }),
    };

    const orderByKey = (
      ALLOWED_SORT_BY.has(sortBy as any) ? sortBy : 'createdAt'
    ) as any;
    const orderBy: Prisma.RoomOrderByWithRelationInput = {
      [orderByKey]: sortOrder,
    };

    const totalItems = await this.prisma.room.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const data = await this.prisma.room.findMany({
      where,
      skip: (safePage - 1) * limit,
      take: limit,
      orderBy,
    });

    return PageResponseDto.of(data, safePage, limit, totalItems);
  }
}
