import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { FilterNotificationRequestDto } from '../dto/notification.dto';

@Injectable()
export class NotificationRepository {
    constructor(private readonly prisma: PrismaRepository) { }

    async create(data: Prisma.NotificationCreateInput): Promise<Notification> {
        return this.prisma.notification.create({ data });
    }

    async findById(id: string): Promise<Notification | null> {
        return this.prisma.notification.findUnique({ where: { id } });
    }

    async update(id: string, data: Prisma.NotificationUpdateInput): Promise<Notification> {
        return this.prisma.notification.update({ where: { id }, data });
    }

    async delete(id: string): Promise<Notification> {
        return this.prisma.notification.delete({ where: { id } });
    }

    async list(params: FilterNotificationRequestDto): Promise<PageResponseDto<Notification>> {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            userId,
            channel,
            read,
        } = params;

        const where: Prisma.NotificationWhereInput = {
            userId,
            channel,
            readAt: read ? { not: null } : { equals: null },
        };

        const totalItems = await this.prisma.notification.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));
        const safePage = Math.min(Math.max(page, 1), totalPages);

        const data = await this.prisma.notification.findMany({
            where,
            skip: (safePage - 1) * limit,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
        });

        return PageResponseDto.of(data, safePage, limit, totalItems);
    }
}
