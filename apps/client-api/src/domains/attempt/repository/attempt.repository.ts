import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { Attempt, Prisma } from '@prisma/client';
import { FilterAttemptRequestDto } from '../dto/attempt.dto';

@Injectable()
export class AttemptRepository {
    constructor(private readonly prisma: PrismaRepository) { }

    async create(data: Prisma.AttemptCreateInput): Promise<Attempt> {
        return this.prisma.attempt.create({ data });
    }

    async findById(id: string): Promise<Attempt | null> {
        return this.prisma.attempt.findUnique({ where: { id } });
    }

    async update(id: string, data: Prisma.AttemptUpdateInput): Promise<Attempt> {
        return this.prisma.attempt.update({ where: { id }, data });
    }

    async delete(id: string): Promise<Attempt> {
        return this.prisma.attempt.delete({ where: { id } });
    }

    async list(params: FilterAttemptRequestDto): Promise<PageResponseDto<Attempt>> {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            userId,
            activityId,
        } = params;

        const where: Prisma.AttemptWhereInput = {
            userId,
            activityId,
        };

        const totalItems = await this.prisma.attempt.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));
        const safePage = Math.min(Math.max(page, 1), totalPages);

        const data = await this.prisma.attempt.findMany({
            where,
            skip: (safePage - 1) * limit,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
        });

        return PageResponseDto.of(data, safePage, limit, totalItems);
    }
}
