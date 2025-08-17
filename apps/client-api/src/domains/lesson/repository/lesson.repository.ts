import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { Lesson, Prisma } from '@prisma/client';
import { CreateLessonDto, FilterLessonRequestDto } from '../dto/lesson.dto';

@Injectable()
export class LessonRepository {
    constructor(private readonly prisma: PrismaRepository) { }

    async create(data: CreateLessonDto): Promise<Lesson> {
        return this.prisma.lesson.create({ data });
    }

    async findById(id: string): Promise<Lesson | null> {
        return this.prisma.lesson.findUnique({ where: { id } });
    }

    async update(id: string, data: Prisma.LessonUpdateInput): Promise<Lesson> {
        return this.prisma.lesson.update({ where: { id }, data });
    }

    async delete(id: string): Promise<Lesson> {
        return this.prisma.lesson.delete({ where: { id } });
    }

    async list(params: FilterLessonRequestDto): Promise<PageResponseDto<Lesson>> {
        const {
            page = 1,
            limit = 10,
            search,
            sortBy = 'orderNo',
            sortOrder = 'asc',
            courseId,
        } = params;

        const where: Prisma.LessonWhereInput = {
            courseId,
            OR: search
                ? [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ]
                : undefined,
        };

        const totalItems = await this.prisma.lesson.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));
        const safePage = Math.min(Math.max(page, 1), totalPages);

        const data = await this.prisma.lesson.findMany({
            where,
            skip: (safePage - 1) * limit,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
        });

        return PageResponseDto.of(data, safePage, limit, totalItems);
    }
}
