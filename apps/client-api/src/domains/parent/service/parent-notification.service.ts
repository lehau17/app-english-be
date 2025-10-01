import { PrismaRepository } from '@app/database';
import { KafkaService } from '@app/shared/kafka/kafka.service';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationType } from '@prisma/client';

export interface ParentNotificationData {
  childId: string;
  childName: string;
  activityTitle: string;
  activityType: string;
  score?: number;
  timeSpent?: number;
  streakDays?: number;
  goalType?: string;
  achievement?: string;
}

@Injectable()
export class ParentNotificationService {
  private readonly logger = new Logger(ParentNotificationService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly kafkaService: KafkaService,
  ) {}

  /**
   * Send notification to parents when child completes an activity
   */
  async notifyActivityCompleted(data: ParentNotificationData) {
    try {
      // Get all parents of this child with notification settings
      const parentChildRelations = await this.prisma.parentChild.findMany({
        where: {
          childId: data.childId,
          notificationsEnabled: true,
          notificationTypes: {
            hasEvery: ['activity_completed'], // Check if activity_completed is enabled
          },
        },
        include: {
          parent: {
            select: {
              id: true,
              email: true,
              displayName: true,
              firstName: true,
            },
          },
        },
      });

      for (const relation of parentChildRelations) {
        // Check if activity completion notifications are enabled
        if (!relation.activityCompletionNotify) continue;

        // Check quiet hours
        if (
          this.isQuietHours(
            relation.quietHoursStart,
            relation.quietHoursEnd,
            relation.timezone,
          )
        ) {
          continue;
        }

        // Create notification message
        const title = `${data.childName} đã hoàn thành bài học!`;
        const body = data.score
          ? `${data.childName} vừa hoàn thành "${data.activityTitle}" với điểm ${data.score}${data.timeSpent ? ` trong ${Math.floor(data.timeSpent / 60)} phút` : ''}.`
          : `${data.childName} vừa hoàn thành "${data.activityTitle}".`;

        await this.sendNotificationToParent({
          parentId: relation.parentId,
          type: 'parent_child',
          title,
          body,
          data: {
            childId: data.childId,
            childName: data.childName,
            activityTitle: data.activityTitle,
            activityType: data.activityType,
            score: data.score,
            timeSpent: data.timeSpent,
            notificationType: 'activity_completed',
          },
          channel: this.getNotificationChannel(relation.notificationSchedule),
        });
      }
    } catch (error) {
      this.logger.error(
        'Failed to send activity completion notification',
        error,
      );
    }
  }

  /**
   * Send notification when child reaches a goal or streak
   */
  async notifyGoalReached(data: ParentNotificationData) {
    try {
      const parentChildRelations = await this.prisma.parentChild.findMany({
        where: {
          childId: data.childId,
          notificationsEnabled: true,
          goalReachedNotify: true,
          notificationTypes: {
            hasEvery: ['achievement'],
          },
        },
        include: {
          parent: {
            select: {
              id: true,
              email: true,
              displayName: true,
              firstName: true,
            },
          },
        },
      });

      for (const relation of parentChildRelations) {
        if (
          this.isQuietHours(
            relation.quietHoursStart,
            relation.quietHoursEnd,
            relation.timezone,
          )
        ) {
          continue;
        }

        let title = '';
        let body = '';

        if (
          data.streakDays &&
          data.streakDays >= (relation.streakNotificationDays || 3)
        ) {
          title = `🔥 ${data.childName} đạt chuỗi học ${data.streakDays} ngày!`;
          body = `Thật tuyệt vời! ${data.childName} đã duy trì việc học liên tục ${data.streakDays} ngày.`;
        } else if (data.goalType) {
          title = `🎯 ${data.childName} đã đạt mục tiêu!`;
          body = `${data.childName} vừa hoàn thành mục tiêu ${data.goalType}.`;
        } else if (data.achievement) {
          title = `🏆 ${data.childName} đạt thành tích mới!`;
          body = `${data.childName} vừa đạt được thành tích: ${data.achievement}.`;
        }

        if (title && body) {
          await this.sendNotificationToParent({
            parentId: relation.parentId,
            type: 'achievement',
            title,
            body,
            data: {
              childId: data.childId,
              childName: data.childName,
              streakDays: data.streakDays,
              goalType: data.goalType,
              achievement: data.achievement,
              notificationType: 'goal_reached',
            },
            channel: this.getNotificationChannel(relation.notificationSchedule),
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to send goal reached notification', error);
    }
  }

  /**
   * Send daily/weekly progress summary to parents
   */
  async notifyProgressSummary(
    childId: string,
    period: 'daily' | 'weekly' = 'daily',
  ) {
    try {
      // Get progress data for the period
      const now = new Date();
      const startDate =
        period === 'daily'
          ? new Date(now.setHours(0, 0, 0, 0))
          : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const progressData = await this.prisma.progress.findMany({
        where: {
          userId: childId,
          createdAt: { gte: startDate },
        },
        include: {
          activity: {
            select: { title: true, type: true },
          },
        },
      });

      if (progressData.length === 0) return;

      const child = await this.prisma.user.findUnique({
        where: { id: childId },
        select: { displayName: true, firstName: true },
      });

      const childName = child?.displayName || child?.firstName || 'Con';
      const completedCount = progressData.filter(
        (p) => p.state === 'done',
      ).length;
      const totalTime = progressData.reduce(
        (sum, p) => sum + (p.timeSpentSec || 0),
        0,
      );
      const avgScore =
        progressData.length > 0
          ? progressData
              .filter((p) => p.score)
              .reduce((sum, p) => sum + (p.score || 0), 0) /
            progressData.filter((p) => p.score).length
          : 0;

      const parentChildRelations = await this.prisma.parentChild.findMany({
        where: {
          childId,
          notificationsEnabled: true,
          notificationTypes: {
            hasEvery: ['progress_summary'],
          },
        },
      });

      for (const relation of parentChildRelations) {
        const title = `📊 Báo cáo ${period === 'daily' ? 'hàng ngày' : 'tuần'} của ${childName}`;
        const body = `${childName} đã hoàn thành ${completedCount} hoạt động trong ${Math.floor(totalTime / 60)} phút${avgScore > 0 ? `, điểm trung bình ${Math.round(avgScore)}` : ''}.`;

        await this.sendNotificationToParent({
          parentId: relation.parentId,
          type: 'parent_child',
          title,
          body,
          data: {
            childId,
            childName,
            period,
            completedCount,
            totalTime: Math.floor(totalTime / 60),
            averageScore: Math.round(avgScore),
            notificationType: 'progress_summary',
          },
          channel: this.getNotificationChannel(relation.notificationSchedule),
        });
      }
    } catch (error) {
      this.logger.error('Failed to send progress summary notification', error);
    }
  }

  private async sendNotificationToParent(params: {
    parentId: string;
    type: NotificationType;
    title: string;
    body: string;
    data: any;
    channel: NotificationChannel;
  }) {
    try {
      // Create notification record in database
      const notification = await this.prisma.notification.create({
        data: {
          userId: params.parentId,
          type: params.type,
          title: params.title,
          body: params.body,
          data: params.data,
          channel: params.channel,
        },
      });

      // Send to Kafka for Socket.IO and email processing
      this.kafkaService.send('notifications', notification);

      this.logger.log(
        `Sent parent notification: ${params.title} to ${params.parentId}`,
      );
    } catch (error) {
      this.logger.error('Failed to send notification to parent', error);
    }
  }

  private isQuietHours(
    quietStart?: string,
    quietEnd?: string,
    timezone?: string,
  ): boolean {
    if (!quietStart || !quietEnd) return false;

    try {
      const now = new Date();
      const timeZone = timezone || 'Asia/Ho_Chi_Minh';

      // Get current time in specified timezone
      const currentTime = new Date(now.toLocaleString('en-US', { timeZone }));
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      const currentTotalMinutes = currentHour * 60 + currentMinute;

      // Parse quiet hours
      const [startHour, startMinute] = quietStart.split(':').map(Number);
      const [endHour, endMinute] = quietEnd.split(':').map(Number);
      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;

      // Handle overnight quiet hours (e.g., 22:00 - 07:00)
      if (startTotalMinutes > endTotalMinutes) {
        return (
          currentTotalMinutes >= startTotalMinutes ||
          currentTotalMinutes <= endTotalMinutes
        );
      }

      // Normal quiet hours (e.g., 12:00 - 14:00)
      return (
        currentTotalMinutes >= startTotalMinutes &&
        currentTotalMinutes <= endTotalMinutes
      );
    } catch (error) {
      this.logger.warn('Failed to check quiet hours', error);
      return false;
    }
  }

  private getNotificationChannel(schedule?: string): NotificationChannel {
    switch (schedule) {
      case 'email_only':
        return 'email';
      case 'realtime':
      case 'instant':
      default:
        return 'socket';
    }
  }
}
