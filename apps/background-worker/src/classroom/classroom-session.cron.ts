import { PrismaRepository } from '@app/database';
import { KafkaService } from '@app/shared';
import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class ClassroomSessionCron {
  private readonly logger = new Logger(ClassroomSessionCron.name);
  private readonly timeZone = 'Asia/Ho_Chi_Minh';
  private readonly tzOffsetMinutes = 7 * 60;

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly kafkaService: KafkaService,
  ) {}

  @Cron('*/10 * * * *')
  async syncSessionStatuses(): Promise<void> {
    const now = new Date();

    const toOngoing = await this.prisma.classroomSession.updateMany({
      where: {
        status: 'scheduled',
        startTime: { lte: now },
        endTime: { gt: now },
      },
      data: {
        status: 'ongoing',
      },
    });

    const toCompleted = await this.prisma.classroomSession.updateMany({
      where: {
        status: 'ongoing',
        endTime: { lte: now },
      },
      data: {
        status: 'completed',
      },
    });

    if (toOngoing.count || toCompleted.count) {
      this.logger.log(
        `Session status sync: ${toOngoing.count} -> ongoing, ${toCompleted.count} -> completed`,
      );
    }
  }

  @Cron('0 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async sendDailyReminders(): Promise<void> {
    const now = new Date();
    const { startUtc, endUtc } = this.getLocalDayRange(now);

    const sessions = await this.prisma.classroomSession.findMany({
      where: {
        status: 'scheduled',
        startTime: {
          gte: startUtc,
          lt: endUtc,
        },
      },
      include: {
        classroom: {
          select: {
            id: true,
            name: true,
            students: {
              include: {
                student: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!sessions.length) {
      this.logger.debug('No classroom sessions scheduled for today.');
      return;
    }

    const studentIds = new Set<string>();
    sessions.forEach((session) => {
      session.classroom.students.forEach((rel) =>
        studentIds.add(rel.studentId),
      );
    });

    const parentRelations = studentIds.size
      ? await this.prisma.parentChild.findMany({
          where: {
            childId: {
              in: Array.from(studentIds),
            },
          },
          include: {
            parent: {
              select: { id: true },
            },
          },
        })
      : [];

    const parentsByChild = parentRelations.reduce<Record<string, string[]>>(
      (acc, relation) => {
        if (!relation.parent?.id) {
          return acc;
        }
        if (!acc[relation.childId]) {
          acc[relation.childId] = [];
        }
        acc[relation.childId].push(relation.parent.id);
        return acc;
      },
      {},
    );

    for (const session of sessions) {
      const formattedStart = this.formatInTimezone(session.startTime);
      const title = `Nhắc lịch học lớp ${session.classroom.name}`;
      const body = `Buổi học của lớp ${session.classroom.name} sẽ diễn ra vào ${formattedStart}. Vui lòng chuẩn bị và tham gia đúng giờ.`;

      const recipients = new Set<string>();
      session.classroom.students.forEach((rel) => {
        recipients.add(rel.studentId);
        const parents = parentsByChild[rel.studentId];
        parents?.forEach((parentId) => recipients.add(parentId));
      });

      for (const userId of recipients) {
        try {
          await lastValueFrom(
            this.kafkaService.send('notifications', {
              userId,
              channel: 'email',
              title,
              body,
            }),
          );
        } catch (error) {
          this.logger.error(
            `Failed to dispatch reminder for session ${session.id} to user ${userId}`,
            error as any,
          );
        }
      }
    }

    this.logger.log(
      `Dispatched reminders for ${sessions.length} classroom sessions.`,
    );
  }

  private getLocalDayRange(reference: Date): { startUtc: Date; endUtc: Date } {
    const tzNow = new Date(
      reference.getTime() + this.tzOffsetMinutes * 60 * 1000,
    );
    const startLocal = new Date(tzNow);
    startLocal.setHours(0, 0, 0, 0);
    const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);

    const startUtc = new Date(
      startLocal.getTime() - this.tzOffsetMinutes * 60 * 1000,
    );
    const endUtc = new Date(
      endLocal.getTime() - this.tzOffsetMinutes * 60 * 1000,
    );

    return { startUtc, endUtc };
  }

  private formatInTimezone(date: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: this.timeZone,
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(date);
  }
}
