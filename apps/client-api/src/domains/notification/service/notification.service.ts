import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { CreateNotificationDto, FilterNotificationRequestDto, UpdateNotificationDto } from '../dto/notification.dto';
import { NotificationRepository } from '../repository/notification.repository';

@Injectable()
export class NotificationService {
    constructor(private readonly notificationRepository: NotificationRepository) { }

    async create(dto: CreateNotificationDto): Promise<Notification> {
        return this.notificationRepository.create(dto);
    }

    async findById(id: string): Promise<Notification> {
        const notification = await this.notificationRepository.findById(id);
        if (!notification) {
            throw new NotFoundException(`Notification with id ${id} not found`);
        }
        return notification;
    }

    async update(id: string, dto: UpdateNotificationDto): Promise<Notification> {
        await this.ensureExists(id);
        const data = {
            readAt: dto.read ? new Date() : null,
        };
        return this.notificationRepository.update(id, data);
    }

    async delete(id: string): Promise<Notification> {
        await this.ensureExists(id);
        return this.notificationRepository.delete(id);
    }

    async list(params: FilterNotificationRequestDto): Promise<PageResponseDto<Notification>> {
        return this.notificationRepository.list(params);
    }

    private async ensureExists(id: string): Promise<void> {
        const exists = await this.notificationRepository.findById(id);
        if (!exists) {
            throw new NotFoundException(`Notification with id ${id} not found`);
        }
    }
}
