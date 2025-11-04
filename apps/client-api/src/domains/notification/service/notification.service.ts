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
  CreateClassroomAnnouncementDto,
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

  /**
   * Create classroom announcement - gửi thông báo đến tất cả học sinh trong lớp
   * @param dto CreateClassroomAnnouncementDto
   * @param senderUserId ID của người gửi (Admin/Teacher)
   * @returns Số lượng notifications đã tạo
   */
  async createClassroomAnnouncement(
    dto: CreateClassroomAnnouncementDto,
    senderUserId: string,
  ): Promise<{ count: number; notificationIds: string[] }> {
    // 1. Tìm classroom và danh sách học sinh
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: dto.classroomId },
      select: {
        id: true,
        name: true,
        teacherId: true,
        students: {
          where: { isActive: true },
          select: { studentId: true },
        },
      },
    });

    if (!classroom) {
      throw new NotFoundException(
        `Classroom with id ${dto.classroomId} not found`,
      );
    }

    // 2. Validate quyền (Admin hoặc Teacher của lớp)
    const sender = await this.prisma.user.findUnique({
      where: { id: senderUserId },
      select: { id: true, role: true },
    });

    if (!sender) {
      throw new NotFoundException(`User with id ${senderUserId} not found`);
    }

    const isAdmin = sender.role === UserRole.admin;
    const isTeacherOfClass = classroom.teacherId === senderUserId;

    if (!isAdmin && !isTeacherOfClass) {
      throw new ForbiddenException(
        'Only admin or teacher of this classroom can send announcements',
      );
    }

    // 3. Lấy danh sách studentIds
    const studentIds = classroom.students.map((s) => s.studentId);

    if (studentIds.length === 0) {
      return { count: 0, notificationIds: [] };
    }

    // 4. Tạo notifications cho từng học sinh trong transaction
    const notifications = await this.prisma.$transaction(
      studentIds.map((studentId) =>
        this.prisma.notification.create({
          data: {
            userId: studentId,
            type: 'system', // hoặc có thể tạo type mới như 'classroom_announcement'
            title: dto.title,
            body: dto.content,
            data: {
              classroomId: dto.classroomId,
              classroomName: classroom.name,
              senderId: senderUserId,
              announcementType: 'classroom',
            },
            channel: 'in_app', // hoặc có thể gửi qua nhiều channel
            priority: 'high',
          },
        }),
      ),
    );

    // 5. Gửi qua Kafka để notification service xử lý (gửi email, push, etc.)
    for (const notification of notifications) {
      this.kafkaService.send('notifications', notification);
    }

    console.log(
      `✅ Classroom announcement sent: ${notifications.length} notifications created for classroom ${dto.classroomId}`,
    );

    return {
      count: notifications.length,
      notificationIds: notifications.map((n) => n.id),
    };
  }
}
