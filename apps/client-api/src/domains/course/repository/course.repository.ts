import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { Course, Prisma } from '@prisma/client';
import { FilterCourseRequestDto } from '../dto/course.dto';

const ALLOWED_SORT_BY = new Set<keyof Prisma.CourseOrderByWithRelationInput>([
  'orderNo',
  'createdAt',
  'price',
  'rating',
  'title',
]);

@Injectable()
export class CourseRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  create(data: Prisma.CourseCreateInput): Promise<Course> {
    return this.prisma.course.create({ data });
  }

  findById(id: string): Promise<Course | null> {
    return this.prisma.course.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.CourseUpdateInput): Promise<Course> {
    return this.prisma.course.update({ where: { id }, data });
  }

  delete(id: string): Promise<Course> {
    return this.prisma.course.delete({ where: { id } });
  }

  async list(params: FilterCourseRequestDto): Promise<PageResponseDto<Course>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'orderNo',
      sortOrder = 'asc',
      difficulty,
      isPublished,
      minPrice,
      maxPrice,
      language,
      instructorId,
      tag,
    } = params;

    const where: Prisma.CourseWhereInput = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(difficulty && { difficulty }),
      ...(typeof isPublished === 'boolean' && { isPublished }),
      ...(typeof minPrice === 'number' || typeof maxPrice === 'number'
        ? {
            price: {
              gte: typeof minPrice === 'number' ? minPrice : undefined,
              lte: typeof maxPrice === 'number' ? maxPrice : undefined,
            },
          }
        : {}),
      ...(language && { language }),
      ...(instructorId && { instructorId }),
      ...(tag && { tags: { has: tag } }),
    };

    // Sort an toàn
    const orderByKey = (
      ALLOWED_SORT_BY.has(sortBy as any) ? sortBy : 'orderNo'
    ) as any;
    const orderBy: Prisma.CourseOrderByWithRelationInput = {
      [orderByKey]: sortOrder,
    };

    const totalItems = await this.prisma.course.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const data = await this.prisma.course.findMany({
      where,
      skip: (safePage - 1) * limit,
      take: limit,
      orderBy,
      include: {
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return PageResponseDto.of(data, safePage, limit, totalItems);
  }
}
