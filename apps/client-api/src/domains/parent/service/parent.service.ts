import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import { ParentDashboardDto } from '../dto/parent-dashboard.dto';

@Injectable()
export class ParentService {
  constructor(private readonly prisma: PrismaRepository) {}

  async getParentDashboard(userId: string): Promise<ParentDashboardDto> {
    try {
      // Get parent-child relationships
      const parentChildRelations = await this.prisma.parentChild.findMany({
        where: { parentId: userId },
        include: {
          child: {
            include: {
              Profile: true,
              Progress: {
                where: {
                  createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)), // Today
                  },
                },
              },
            },
          },
        },
      });

      // Transform children data
      const children = parentChildRelations.map((relation) => {
        const child = relation.child;
        const profile = child.Profile;
        const todayProgress = child.Progress || [];

        const completedActivities = todayProgress.filter(
          (p) => p.state === 'done',
        ).length;
        const totalActivities = todayProgress.length;

        return {
          id: child.id,
          name:
            child.displayName || child.firstName || child.email || 'Unknown',
          avatar: child.avatarUrl || undefined,
          level: parseInt(profile?.currentLevel) || 1,
          xp: 0, // Gamification removed
          xpToNext: 1000, // Placeholder
          streak: profile?.studyStreak || 0,
          coins: 0, // Gamification removed
          todayStudyTime: profile?.totalStudyTime || 0,
          completedActivities,
          totalActivities,
          recentActivity: 'Đang học tiếng Anh', // Placeholder
          lastActive: child.lastActiveAt
            ? new Date(child.lastActiveAt).toLocaleString('vi-VN')
            : 'Chưa hoạt động',
        };
      });

      // Get custom rewards created by parent
      const rewards = await this.prisma.customReward.findMany({
        where: { parentId: userId },
        orderBy: { createdAt: 'desc' },
      });

      const transformedRewards = rewards.map((reward) => ({
        id: reward.id,
        title: reward.title,
        description: reward.description || undefined,
        cost: reward.cost,
        claimed: false, // This would need to be calculated based on claims
      }));

      // Get notifications for parent
      const notifications = await this.prisma.notification.findMany({
        where: {
          userId,
          type: { in: ['achievement', 'parent_child'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const transformedNotifications = notifications.map((notification) => ({
        type: notification.type as
          | 'achievement'
          | 'activity'
          | 'reminder'
          | 'system',
        title: notification.title,
        message: notification.body || '',
        time: new Date(notification.createdAt).toLocaleString('vi-VN'),
        read: !!notification.readAt,
      }));

      // Calculate totals
      const totalStudyTime = children.reduce(
        (sum, child) => sum + child.todayStudyTime,
        0,
      );
      const totalCompleted = children.reduce(
        (sum, child) => sum + child.completedActivities,
        0,
      );
      const totalActivities = children.reduce(
        (sum, child) => sum + child.totalActivities,
        0,
      );
      const completionRate =
        totalActivities > 0 ? (totalCompleted / totalActivities) * 100 : 0;

      return {
        children,
        rewards: transformedRewards,
        notifications: transformedNotifications,
        totalStudyTime,
        completionRate,
      };
    } catch (error) {
      console.error('Error fetching parent dashboard:', error);
      return ParentDashboardDto.defaultValueResponse();
    }
  }
}
