import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { Progress, Prisma } from '@prisma/client';
import { FilterProgressRequestDto } from '../dto/progress.dto';

@Injectable()
export class ProgressRepository {
    constructor(private readonly prisma: PrismaRepository) { }

    async create(data: Prisma.ProgressCreateInput): Promise<Progress> {
        return this.prisma.progress.create({ data });
    }

    async findById(id: string): Promise<Progress | null> {
        return this.prisma.progress.findUnique({ where: { id } });
    }

    async update(id: string, data: Prisma.ProgressUpdateInput): Promise<Progress> {
        return this.prisma.progress.update({ where: { id }, data });
    }

    async delete(id: string): Promise<Progress> {
        return this.prisma.progress.delete({ where: { id } });
    }

    async list(params: FilterProgressRequestDto): Promise<PageResponseDto<Progress>> {
        const {
            page = 1,
            limit = 10,
            sortBy = 'updatedAt',
            sortOrder = 'desc',
            userId,
            activityId,
            state,
        } = params;

        const where: Prisma.ProgressWhereInput = {
            userId,
            activityId,
            state,
        };

        const totalItems = await this.prisma.progress.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));
        const safePage = Math.min(Math.max(page, 1), totalPages);

        const data = await this.prisma.progress.findMany({
            where,
            skip: (safePage - 1) * limit,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
        });

        return PageResponseDto.of(data, safePage, limit, totalItems);
    }
}
