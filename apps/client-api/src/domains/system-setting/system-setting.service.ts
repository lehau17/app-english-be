import { PrismaRepository } from '@app/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSystemSettingDto, UpdateSystemSettingDto } from './dto/system-setting.dto';

@Injectable()
export class SystemSettingService {
    constructor(private readonly prisma: PrismaRepository) { }

    async findAll() {
        return this.prisma.systemSetting.findMany();
    }

    async findPublicSettings() {
        return this.prisma.systemSetting.findMany({
            where: {
                isPublic: true,
            },
        });
    }

    async findByKey(key: string) {
        const setting = await this.prisma.systemSetting.findUnique({
            where: { key },
        });
        if (!setting) {
            throw new NotFoundException(`Setting with key ${key} not found`);
        }
        return setting;
    }

    async create(dto: CreateSystemSettingDto) {
        return this.prisma.systemSetting.create({
            data: dto,
        });
    }

    async update(key: string, dto: UpdateSystemSettingDto) {
        // Upsert logic: update if exists, create if not
        return this.prisma.systemSetting.upsert({
            where: { key },
            update: {
                value: dto.value,
                description: dto.description,
                isPublic: dto.isPublic,
            },
            create: {
                key,
                value: dto.value,
                description: dto.description,
                isPublic: dto.isPublic ?? false,
            },
        });
    }

    // Initialize default settings if they don't exist
    async initializeDefaults() {
        const defaults = [
            { key: 'center_open_time', value: '07:00', description: 'Center opening time', isPublic: true },
            { key: 'center_close_time', value: '22:00', description: 'Center closing time', isPublic: true },
        ];

        for (const setting of defaults) {
            const exists = await this.prisma.systemSetting.findUnique({ where: { key: setting.key } });
            if (!exists) {
                await this.prisma.systemSetting.create({ data: setting });
            }
        }
    }
}
