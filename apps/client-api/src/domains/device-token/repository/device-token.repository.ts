import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { DeviceToken, Prisma } from '@prisma/client';
import { CreateDeviceTokenDto, FilterDeviceTokenRequestDto } from '../dto/device-token.dto';

@Injectable()
export class DeviceTokenRepository {
    constructor(private readonly prisma: PrismaRepository) { }

    async create(data: CreateDeviceTokenDto): Promise<DeviceToken> {
        return this.prisma.deviceToken.create({ data });
    }

    async findById(id: string): Promise<DeviceToken | null> {
        return this.prisma.deviceToken.findUnique({ where: { id } });
    }

    async update(id: string, data: Prisma.DeviceTokenUpdateInput): Promise<DeviceToken> {
        return this.prisma.deviceToken.update({ where: { id }, data });
    }

    async delete(id: string): Promise<DeviceToken> {
        return this.prisma.deviceToken.delete({ where: { id } });
    }

    async list(params: FilterDeviceTokenRequestDto): Promise<PageResponseDto<DeviceToken>> {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            userId,
            platform,
        } = params;

        const where: Prisma.DeviceTokenWhereInput = {
            userId,
            platform,
        };

        const totalItems = await this.prisma.deviceToken.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));
        const safePage = Math.min(Math.max(page, 1), totalPages);

        const data = await this.prisma.deviceToken.findMany({
            where,
            skip: (safePage - 1) * limit,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
        });

        return PageResponseDto.of(data, safePage, limit, totalItems);
    }
}
