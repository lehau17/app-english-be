import { PrismaRepository } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationType, UserRole } from '@prisma/client';
import { Tool } from 'langchain/tools';

@Injectable()
export class NotificationSenderTool extends Tool {
  name = 'send_notification';
  description = `Gửi thông báo cho người dùng hoặc nhóm người dùng.

TRIGGER: Sử dụng khi admin muốn:
- "gửi thông báo cho học viên"
- "thông báo cho lớp [tên]"
- "gửi email cho tất cả giáo viên"
- "notify all students"
- "gửi thông báo về [nội dung]"

INPUT: JSON với các trường:
- title: Tiêu đề thông báo (required)
- body: Nội dung thông báo (required)
- targetType: 'user' | 'role' | 'classroom' | 'course' | 'all' (required)
- targetId (optional): ID của user/classroom/course cụ thể
- targetRole (optional): 'student' | 'teacher' | 'parent' khi targetType = 'role'

OUTPUT: Trả về:
- Số lượng người nhận
- Trạng thái gửi thông báo
- Danh sách người nhận (nếu ít)`;

  private readonly logger = new Logger(NotificationSenderTool.name);

  constructor(private prisma: PrismaRepository) {
    super();
  }

  async _call(input: string): Promise<string> {
    try {
      this.logger.log(`🔔 Notification Sender Tool called with: ${input}`);

      let params: {
        title: string;
        body: string;
        targetType: 'user' | 'role' | 'classroom' | 'course' | 'all';
        targetId?: string;
        targetRole?: string;
      };

      try {
        params = JSON.parse(input);
      } catch {
        return JSON.stringify({
          success: false,
          error: 'Input không hợp lệ. Cần JSON với title, body, targetType.',
        });
      }

      // Validate required fields
      if (!params.title || !params.body || !params.targetType) {
        return JSON.stringify({
          success: false,
          error: 'Thiếu thông tin bắt buộc: title, body, targetType',
        });
      }

      // Get target users
      const targetUsers = await this.getTargetUsers(params);

      if (targetUsers.length === 0) {
        return JSON.stringify({
          success: false,
          message: 'Không tìm thấy người nhận nào phù hợp với điều kiện.',
        });
      }

      // Create notifications
      const notifications = await this.createNotifications(targetUsers, params);

      return JSON.stringify({
        success: true,
        message: `Đã gửi thông báo thành công cho ${notifications.length} người.`,
        summary: {
          totalRecipients: notifications.length,
          title: params.title,
          targetType: params.targetType,
        },
        recipients:
          targetUsers.length <= 10
            ? targetUsers.map((u) => ({
                id: u.id,
                name: u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
                email: u.email,
              }))
            : `${targetUsers.length} người (danh sách quá dài để hiển thị)`,
      });
    } catch (error) {
      this.logger.error('Notification Sender error:', error);
      return JSON.stringify({
        success: false,
        error: 'Lỗi khi gửi thông báo: ' + (error as Error).message,
      });
    }
  }

  private async getTargetUsers(params: {
    targetType: string;
    targetId?: string;
    targetRole?: string;
  }): Promise<any[]> {
    switch (params.targetType) {
      case 'user':
        if (!params.targetId) return [];
        const user = await this.prisma.user.findUnique({
          where: { id: params.targetId },
        });
        return user ? [user] : [];

      case 'role':
        if (!params.targetRole) return [];
        return await this.prisma.user.findMany({
          where: { role: params.targetRole as UserRole },
          take: 1000,
        });

      case 'classroom':
        if (!params.targetId) return [];
        const classroomStudents = await this.prisma.classroomStudent.findMany({
          where: { classroomId: params.targetId, isActive: true },
          include: { student: true },
        });
        return classroomStudents.map((cs) => cs.student);

      case 'course':
        if (!params.targetId) return [];
        const courseClassrooms = await this.prisma.classroom.findMany({
          where: { courseId: params.targetId },
          include: {
            students: {
              include: { student: true },
            },
          },
        });
        const courseStudents = new Map();
        courseClassrooms.forEach((c) => {
          c.students.forEach((s) => {
            courseStudents.set(s.studentId, s.student);
          });
        });
        return Array.from(courseStudents.values());

      case 'all':
        return await this.prisma.user.findMany({
          take: 5000,
        });

      default:
        return [];
    }
  }

  private async createNotifications(
    users: any[],
    params: { title: string; body: string },
  ): Promise<any[]> {
    const notifications = await Promise.all(
      users.map(async (user) => {
        return await this.prisma.notification.create({
          data: {
            userId: user.id,
            title: params.title,
            body: params.body,
            type: NotificationType.system,
            channel: NotificationChannel.in_app,
          },
        });
      }),
    );

    this.logger.log(`Created ${notifications.length} notifications`);

    return notifications;
  }
}
