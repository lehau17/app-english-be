import { PrismaRepository } from '@app/database';
import { RequestContext } from '@app/shared';
import { KafkaService } from '@app/shared/kafka/kafka.service';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Notification, UserRole } from '@prisma/client';
import {
  CreateClassroomNotificationDto,
  CreateNotificationDto,
  FilterNotificationRequestDto,
  UpdateNotificationDto,
} from '../dto/notification.dto';
import { NotificationRepository } from '../repository/notification.repository';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly kafkaService: KafkaService,
    private readonly prisma: PrismaRepository,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = await this.notificationRepository.create(dto);
    this.kafkaService.send('notifications', notification);
    return notification;
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

  async list(
    params: FilterNotificationRequestDto,
  ): Promise<PageResponseDto<Notification>> {
    const ctx = RequestContext.get();
    const userId = (ctx?.user?.sub as string) || params.userId;
    return this.notificationRepository.list({ ...params, userId });
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.notificationRepository.findById(id);
    if (!exists) {
      throw new NotFoundException(`Notification with id ${id} not found`);
    }
  }

  async broadcastToClassroom(
    classroomId: string,
    dto: CreateClassroomNotificationDto,
  ): Promise<{ count: number }> {
    const payload = RequestContext.getValue<any>('user');
    if (!payload) {
      throw new ForbiddenException('Missing user context');
    }

    // Verify classroom and teacher ownership (or admin override)
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      select: {
        id: true,
        teacherId: true,
        students: { select: { studentId: true, isActive: true } },
      },
    });
    if (!classroom) {
      throw new NotFoundException(`Classroom ${classroomId} not found`);
    }

    const isAdmin = payload.role === UserRole.admin || payload.role === 'admin';
    const isOwnerTeacher = classroom.teacherId === payload.sub;
    if (!isAdmin && !isOwnerTeacher) {
      throw new ForbiddenException(
        'Not allowed to broadcast for this classroom',
      );
    }

    const studentIds = classroom.students
      .filter((s) => s.isActive)
      .map((s) => s.studentId);

    if (studentIds.length === 0) {
      return { count: 0 };
    }

    // Create a notification per student; also publish to Kafka per item
    const created = await this.prisma.$transaction(
      studentIds.map((userId) =>
        this.prisma.notification.create({
          data: {
            userId,
            type: dto.type,
            title: dto.title,
            body: dto.body,
            data: dto.data ? (JSON.parse(dto.data) as any) : undefined,
            channel: dto.channel,
          },
        }),
      ),
    );

    for (const n of created) {
      this.kafkaService.send('notifications', n);
    }

    return { count: created.length };
  }
}
