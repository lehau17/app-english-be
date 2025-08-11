
import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { Course, Prisma } from '@prisma/client';
import { FilterCourseRequestDto } from '../dto/course.dto';

@Injectable()
export class CourseRepository {
    constructor(private readonly prisma: PrismaRepository) { }

    async create(data: Prisma.CourseCreateInput): Promise<Course> {
        return this.prisma.course.create({ data });
    }

    async findById(id: string): Promise<Course | null> {
        return this.prisma.course.findUnique({ where: { id } });
    }

    async update(id: string, data: Prisma.CourseUpdateInput): Promise<Course> {
        return this.prisma.course.update({ where: { id }, data });
    }

    async delete(id: string): Promise<Course> {
        return this.prisma.course.delete({ where: { id } });
    }

    async list(params: FilterCourseRequestDto): Promise<PageResponseDto<Course>> {
        const {
            page = 1,
            limit = 10,
            search,
            sortBy = 'orderNo',
            sortOrder = 'asc',
        } = params;

        const where: Prisma.CourseWhereInput = {
            OR: search
                ? [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ]
                : undefined,
        };

        const totalItems = await this.prisma.course.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));
        const safePage = Math.min(Math.max(page, 1), totalPages);

        const data = await this.prisma.course.findMany({
            where,
            skip: (safePage - 1) * limit,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
        });

        return PageResponseDto.of(data, safePage, limit, totalItems);
    }
}
