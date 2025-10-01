import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ParentChildService } from '../../parent-child/service/parent-child.service';
import { ParentDashboardDto, UpdateParentChildSettingsDto } from '../dto';
import {
  CreateParentRewardDto,
  UiRewardType,
  UpdateParentRewardDto,
} from '../dto/parent-reward.dto';

@Injectable()
export class ParentService {
  constructor(
    private readonly prisma: PrismaRepository,
    private readonly parentChildService: ParentChildService,
  ) {}

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
        type: reward.type || 'custom',
        imageUrl: reward.imageUrl || undefined,
        isActive: reward.isActive,
        claimsCount: 0, // Would need to calculate from actual claims
        createdAt: reward.createdAt,
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
        id: notification.id,
        type: notification.type,
        body: notification.body || '',
        data: notification.data || undefined,
        readAt: notification.readAt || undefined,
        createdAt: notification.createdAt,
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

  async getChildren(parentId: string) {
    try {
      const parentChildRelations = await this.prisma.parentChild.findMany({
        where: { parentId },
        include: {
          child: {
            include: {
              Profile: true,
            },
          },
        },
      });

      return parentChildRelations.map((relation) => ({
        id: relation.child.id,
        name:
          relation.child.displayName ||
          relation.child.firstName ||
          relation.child.email ||
          'Unknown',
        avatar: relation.child.avatarUrl || null,
        level: parseInt(relation.child.Profile?.currentLevel) || 1,
        lastActive: relation.child.lastActiveAt,
        settings: {
          canViewProgress: relation.canViewProgress,
          canSetGoals: relation.canSetGoals,
          canControlTime: relation.canControlTime,
          dailyTimeLimit: relation.dailyTimeLimit,
          bedtimeStart: relation.bedtimeStart,
          bedtimeEnd: relation.bedtimeEnd,
          notificationsEnabled: relation.notificationsEnabled,
          notificationTypes: relation.notificationTypes,
          notificationSchedule: relation.notificationSchedule,
          quietHoursStart: relation.quietHoursStart,
          quietHoursEnd: relation.quietHoursEnd,
        },
      }));
    } catch (error) {
      console.error('Error fetching children:', error);
      return [];
    }
  }

  async getRewards(parentId: string) {
    try {
      const rewards = await this.prisma.customReward.findMany({
        where: { parentId },
        include: {
          claims: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return rewards.map((reward) => ({
        id: reward.id,
        title: reward.title,
        description: reward.description,
        cost: (reward as any).cost ?? 0,
        // Map DB RewardType back to UI categories for consistency
        type: this.mapDbTypeToUiType(reward.type as any),
        imageUrl: reward.imageUrl,
        isActive: reward.isActive,
        claimsCount: reward.claims.length,
        createdAt: reward.createdAt,
      }));
    } catch (error) {
      console.error('Error fetching rewards:', error);
      return [];
    }
  }

  async createReward(parentId: string, dto: CreateParentRewardDto) {
    // ensure relation exists
    const rel = await this.prisma.parentChild.findUnique({
      where: { parentId_childId: { parentId, childId: dto.targetChildId } },
    });
    if (!rel)
      throw new NotFoundException('Parent-child relationship not found');

    const created = await this.prisma.customReward.create({
      data: {
        parentId,
        childId: dto.targetChildId,
        title: dto.title,
        description: dto.description,
        type: this.mapUiTypeToDbType(dto.type) as any,
        cost: (dto.cost as any) ?? 0,
        imageUrl: dto.imageUrl,
        isActive: true,
        metadata: null,
      } as any,
    });

    return { id: created.id };
  }

  async updateReward(
    parentId: string,
    rewardId: string,
    dto: UpdateParentRewardDto,
  ) {
    const existing = await this.prisma.customReward.findUnique({
      where: { id: rewardId },
    });
    if (!existing) throw new NotFoundException('Reward not found');
    if (existing.parentId !== parentId)
      throw new ForbiddenException('Not owner of reward');

    const updated = await this.prisma.customReward.update({
      where: { id: rewardId },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        type: dto.type ? (this.mapUiTypeToDbType(dto.type) as any) : undefined,
        imageUrl: dto.imageUrl ?? undefined,
        childId: dto.targetChildId ?? undefined,
        cost: (dto.cost as any) ?? undefined,
      } as any,
    });

    return { id: updated.id };
  }

  async deleteReward(parentId: string, rewardId: string) {
    const existing = await this.prisma.customReward.findUnique({
      where: { id: rewardId },
    });
    if (!existing) throw new NotFoundException('Reward not found');
    if (existing.parentId !== parentId)
      throw new ForbiddenException('Not owner of reward');
    await this.prisma.customReward.delete({ where: { id: rewardId } });
    return true;
  }

  async toggleReward(parentId: string, rewardId: string) {
    const existing = await this.prisma.customReward.findUnique({
      where: { id: rewardId },
    });
    if (!existing) throw new NotFoundException('Reward not found');
    if (existing.parentId !== parentId)
      throw new ForbiddenException('Not owner of reward');
    const updated = await this.prisma.customReward.update({
      where: { id: rewardId },
      data: { isActive: !existing.isActive },
    });
    return { id: updated.id, isActive: updated.isActive };
  }

  async getNotifications(
    parentId: string,
    options: { page?: number; limit?: number },
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;

      const totalItems = await this.prisma.notification.count({
        where: {
          userId: parentId,
          type: { in: ['achievement', 'parent_child'] },
        },
      });

      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const safePage = Math.min(Math.max(page, 1), totalPages);

      const notifications = await this.prisma.notification.findMany({
        where: {
          userId: parentId,
          type: { in: ['achievement', 'parent_child'] },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * limit,
        take: limit,
      });

      const data = notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      }));

      return PageResponseDto.of(data, safePage, limit, totalItems);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return PageResponseDto.of([], 1, 20, 0);
    }
  }

  async getChildSettings(parentId: string, childId: string) {
    try {
      const parentChild = await this.prisma.parentChild.findUnique({
        where: {
          parentId_childId: { parentId, childId },
        },
      });

      if (!parentChild) {
        throw new NotFoundException('Parent-child relationship not found');
      }

      return {
        canViewProgress: parentChild.canViewProgress,
        canSetGoals: parentChild.canSetGoals,
        canControlTime: parentChild.canControlTime,
        dailyTimeLimit: parentChild.dailyTimeLimit,
        bedtimeStart: parentChild.bedtimeStart,
        bedtimeEnd: parentChild.bedtimeEnd,
        allowedActivities: parentChild.allowedActivities,
        blockedContent: parentChild.blockedContent,
        notificationsEnabled: parentChild.notificationsEnabled,
        notificationTypes: parentChild.notificationTypes,
        notificationSchedule: parentChild.notificationSchedule,
        quietHoursStart: parentChild.quietHoursStart,
        quietHoursEnd: parentChild.quietHoursEnd,
        timezone: parentChild.timezone,
        minProgressThreshold: parentChild.minProgressThreshold,
        streakNotificationDays: parentChild.streakNotificationDays,
        activityCompletionNotify: parentChild.activityCompletionNotify,
        goalReachedNotify: parentChild.goalReachedNotify,
      };
    } catch (error) {
      console.error('Error fetching child settings:', error);
      throw error;
    }
  }

  async updateChildSettings(
    parentId: string,
    childId: string,
    dto: UpdateParentChildSettingsDto,
  ) {
    try {
      // Verify parent-child relationship exists
      const existing = await this.prisma.parentChild.findUnique({
        where: {
          parentId_childId: { parentId, childId },
        },
      });

      if (!existing) {
        throw new NotFoundException('Parent-child relationship not found');
      }

      const updated = await this.prisma.parentChild.update({
        where: {
          parentId_childId: { parentId, childId },
        },
        data: dto,
      });

      return {
        message: 'Settings updated successfully',
        settings: {
          canViewProgress: updated.canViewProgress,
          canSetGoals: updated.canSetGoals,
          canControlTime: updated.canControlTime,
          dailyTimeLimit: updated.dailyTimeLimit,
          bedtimeStart: updated.bedtimeStart,
          bedtimeEnd: updated.bedtimeEnd,
          notificationsEnabled: updated.notificationsEnabled,
          notificationTypes: updated.notificationTypes,
          notificationSchedule: updated.notificationSchedule,
          quietHoursStart: updated.quietHoursStart,
          quietHoursEnd: updated.quietHoursEnd,
        },
      };
    } catch (error) {
      console.error('Error updating child settings:', error);
      throw error;
    }
  }

  async getChildProgress(
    parentId: string,
    childId: string,
    options: {
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    try {
      // Verify parent-child relationship
      const parentChild = await this.prisma.parentChild.findUnique({
        where: {
          parentId_childId: { parentId, childId },
        },
      });

      if (!parentChild || !parentChild.canViewProgress) {
        throw new NotFoundException('Cannot access child progress');
      }

      const page = options.page || 1;
      const limit = options.limit || 50;

      const fromDate = options.from
        ? new Date(options.from)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const toDate = options.to ? new Date(options.to) : new Date();

      const totalItems = await this.prisma.progress.count({
        where: {
          userId: childId,
          createdAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
      });

      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const safePage = Math.min(Math.max(page, 1), totalPages);

      const progressData = await this.prisma.progress.findMany({
        where: {
          userId: childId,
          createdAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              type: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * limit,
        take: limit,
      });

      const data = progressData.map((progress) => ({
        id: progress.id,
        activityTitle: progress.activity?.title || 'Unknown Activity',
        activityType: progress.activity?.type || 'Unknown',
        state: progress.state,
        score: progress.score,
        timeSpent: progress.timeSpentSec || 0,
        createdAt: progress.createdAt,
      }));

      return PageResponseDto.of(data, safePage, limit, totalItems);
    } catch (error) {
      console.error('Error fetching child progress:', error);
      throw error;
    }
  }

  async getActivities(
    parentId: string,
    options: {
      page?: number;
      limit?: number;
      childId?: string;
      type?: string;
      status?: string;
    },
  ) {
    try {
      // Get all children under parent's control
      const parentChildRelations = await this.prisma.parentChild.findMany({
        where: { parentId },
        select: { childId: true },
      });

      if (parentChildRelations.length === 0) {
        return PageResponseDto.of([], 1, 20, 0);
      }

      const childrenIds = parentChildRelations.map(
        (relation) => relation.childId,
      );

      // Filter by specific child if requested
      const targetChildIds = options.childId ? [options.childId] : childrenIds;

      const page = options.page || 1;
      const limit = options.limit || 20;

      // Build where clause
      const where: any = {
        userId: { in: targetChildIds },
      };

      if (options.status) {
        where.state = options.status;
      }

      // Get activities through progress records
      const totalItems = await this.prisma.progress.count({ where });

      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const safePage = Math.min(Math.max(page, 1), totalPages);

      const activities = await this.prisma.progress.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              avatarUrl: true,
            },
          },
          activity: {
            select: {
              id: true,
              title: true,
              type: true,
              difficulty: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * limit,
        take: limit,
      });

      const data = activities.map((progress) => ({
        id: progress.id,
        childId: progress.userId,
        childName:
          progress.user.displayName || progress.user.firstName || 'Unknown',
        childAvatar: progress.user.avatarUrl || undefined,
        type: progress.activity?.type || 'unknown',
        title: progress.activity?.title || 'Unknown Activity',
        status:
          progress.state === 'done'
            ? 'completed'
            : progress.state === 'in_progress'
              ? 'in_progress'
              : 'failed',
        score: progress.score || undefined,
        timeSpent: Math.floor((progress.timeSpentSec || 0) / 60), // Convert to minutes
        startedAt: progress.createdAt,
        completedAt: progress.state === 'done' ? progress.updatedAt : undefined,
        difficulty: progress.activity?.difficulty || 'medium',
        category: this.getCategoryFromType(progress.activity?.type),
      }));

      return PageResponseDto.of(data, safePage, limit, totalItems);
    } catch (error) {
      console.error('Error fetching activities:', error);
      return PageResponseDto.of([], 1, 20, 0);
    }
  }

  private getCategoryFromType(type?: string): string {
    const categoryMap: Record<string, string> = {
      vocabulary: 'Từ vựng',
      grammar: 'Ngữ pháp',
      listening: 'Nghe',
      speaking: 'Nói',
      reading: 'Đọc',
      writing: 'Viết',
      podcast: 'Podcast',
      game: 'Trò chơi',
    };

    return categoryMap[type || ''] || 'Khác';
  }

  private mapUiTypeToDbType(ui: UiRewardType): string {
    switch (ui) {
      case UiRewardType.activity:
        return 'activity';
      case UiRewardType.item:
        return 'physical';
      case UiRewardType.experience:
        return 'digital';
      case UiRewardType.privilege:
      default:
        return 'digital';
    }
  }

  private mapDbTypeToUiType(db: string): UiRewardType {
    switch (db) {
      case 'activity':
        return UiRewardType.activity;
      case 'physical':
        return UiRewardType.item;
      case 'digital':
        return UiRewardType.privilege;
      default:
        return UiRewardType.experience;
    }
  }

  async getUnpaidClassrooms(parentId: string) {
    try {
      // Get children of the parent
      const parentChildRelations = await this.prisma.parentChild.findMany({
        where: { parentId },
        include: {
          child: true,
        },
      });

      const childIds = parentChildRelations.map((rel) => rel.childId);

      if (childIds.length === 0) {
        return [];
      }

      // Get unpaid classroom enrollments for these children
      const unpaidEnrollments = await this.prisma.classroomStudent.findMany({
        where: {
          studentId: { in: childIds },
          isActive: true,
          isPurchased: false, // Only unpaid
        },
        include: {
          classroom: {
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  price: true,
                  currency: true,
                },
              },
              teacher: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      const unpaidClassrooms = [];

      for (const enrollment of unpaidEnrollments) {
        const classroom = enrollment.classroom;
        const child = enrollment.student;

        // Only include classrooms with paid courses
        if (classroom.course?.price && classroom.course.price > 0) {
          unpaidClassrooms.push({
            id: classroom.id,
            name: classroom.name,
            classCode: classroom.classCode,
            status: classroom.status,
            periodStart: classroom.periodStart,
            periodEnd: classroom.periodEnd,
            child: {
              id: child.id,
              firstName: child.firstName,
              lastName: child.lastName,
              displayName: child.displayName,
              avatarUrl: child.avatarUrl,
            },
            course: classroom.course,
            teacher: classroom.teacher,
            _count: {
              students: await this.prisma.classroomStudent.count({
                where: { classroomId: classroom.id, isActive: true },
              }),
              assignments: await this.prisma.assignment.count({
                where: { classroomId: classroom.id },
              }),
            },
          });
        }
      }

      return unpaidClassrooms;
    } catch (error) {
      console.error('Error fetching unpaid classrooms:', error);
      return [];
    }
  }

  async getPaymentSummary(parentId: string) {
    try {
      const unpaidClassrooms = await this.getUnpaidClassrooms(parentId);

      const totalUnpaid = unpaidClassrooms.length;
      const totalAmount = unpaidClassrooms.reduce(
        (sum, classroom) => sum + (classroom.course?.price || 0),
        0,
      );

      // Count urgent payments (ongoing classes)
      const urgentPayments = unpaidClassrooms.filter(
        (classroom) => classroom.status === 'ongoing',
      ).length;

      // Group by children
      const childrenSummary = unpaidClassrooms.reduce(
        (acc, classroom) => {
          const childId = classroom.child.id;
          if (!acc[childId]) {
            acc[childId] = {
              child: classroom.child,
              unpaidCount: 0,
              totalAmount: 0,
              urgentCount: 0,
            };
          }

          acc[childId].unpaidCount++;
          acc[childId].totalAmount += classroom.course?.price || 0;
          if (classroom.status === 'ongoing') {
            acc[childId].urgentCount++;
          }

          return acc;
        },
        {} as Record<string, any>,
      );

      return {
        totalUnpaid,
        totalAmount,
        urgentPayments,
        children: Object.values(childrenSummary),
      };
    } catch (error) {
      console.error('Error fetching payment summary:', error);
      return {
        totalUnpaid: 0,
        totalAmount: 0,
        urgentPayments: 0,
        children: [],
      };
    }
  }
}
