import { PrismaRepository } from '@app/database';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

/**
 * UserManagementTool - Cong cu quan ly va tim kiem user
 *
 * Features:
 * - Tim kiem user theo nhieu tieu chi
 * - Xem thong tin chi tiet user
 * - Thong ke user theo role
 * - Xem hoat dong gan day cua user
 */
@Injectable()
export class UserManagementTool {
  private readonly logger = new Logger(UserManagementTool.name);

  constructor(private readonly prisma: PrismaRepository) {}

  getTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'manage_users',
      description: `Quan ly va tim kiem nguoi dung trong he thong. Su dung khi:
- "tim user", "tim hoc sinh/giao vien"
- "thong tin user", "xem profile"
- "thong ke user", "co bao nhieu hoc sinh"
- "user moi dang ky", "hoat dong user"
- "danh sach giao vien", "admin nao dang hoat dong"
OUTPUT: Danh sach user hoac thong tin chi tiet.`,
      schema: z.object({
        action: z.enum(['search', 'detail', 'stats', 'recent']).optional().default('stats').describe('Hanh dong'),
        query: z.string().optional().describe('Ten/email de tim'),
        role: z.enum(['student', 'teacher', 'parent', 'admin', 'all']).optional().default('all').describe('Role'),
        userId: z.string().optional().describe('ID user (cho action detail)'),
        limit: z.number().optional().default(20).describe('So luong ket qua'),
        period: z.string().optional().describe('Khoang thoi gian'),
      }),
      func: async ({ action = 'stats', query, role = 'all', userId, limit = 20, period }) => {
        return this._call(JSON.stringify({ action, query, role, userId, limit, period }));
      },
    });
  }

  private async _call(input: string): Promise<string> {
    try {
      this.logger.log(`User Management Tool called: ${input}`);

      let params: {
        action?: string;
        query?: string;
        role?: string;
        userId?: string;
        limit?: number;
        period?: string;
      } = {};

      try {
        params = JSON.parse(input);
      } catch {
        params = { action: 'stats' };
      }

      const action = params.action || 'stats';
      const role = params.role || 'all';
      const limit = params.limit || 20;

      switch (action) {
        case 'search':
          return await this.searchUsers(params.query || '', role, limit);
        case 'detail':
          return await this.getUserDetail(params.userId || '');
        case 'stats':
          return await this.getUserStats(role);
        case 'recent':
          return await this.getRecentUsers(role, limit, params.period);
        default:
          return await this.getUserStats(role);
      }
    } catch (error) {
      this.logger.error('User Management error:', error);
      return JSON.stringify({
        success: false,
        error: 'Lỗi khi truy vấn user: ' + (error as Error).message,
      });
    }
  }

  private async searchUsers(
    query: string,
    role: string,
    limit: number,
  ): Promise<string> {
    const whereClause: any = {
      OR: [
        { email: { contains: query, mode: 'insensitive' } },
        { displayName: { contains: query, mode: 'insensitive' } },
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
      ],
    };

    if (role !== 'all') {
      whereClause.role = role;
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        avatarUrl: true,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return JSON.stringify({
      success: true,
      action: 'search',
      query,
      role,
      count: users.length,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'N/A',
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        lastLogin: u.lastLoginAt,
        hasAvatar: !!u.avatarUrl,
      })),
    });
  }

  private async getUserDetail(userId: string): Promise<string> {
    if (!userId) {
      return JSON.stringify({
        success: false,
        error: 'Cần cung cấp userId',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        Profile: true,
        classroomsStudying: {
          where: { isActive: true },
          include: {
            classroom: {
              select: { id: true, name: true },
            },
          },
        },
        classroomsTeaching: {
          where: { isActive: true },
          select: { id: true, name: true },
        },
      },
    });

    if (!user) {
      return JSON.stringify({
        success: false,
        error: 'Không tìm thấy user',
      });
    }

    // Get activity stats
    const [submissionCount, progressCount, lastActivity] = await Promise.all([
      this.prisma.assignmentSubmission.count({
        where: { studentId: userId },
      }),
      this.prisma.progress.count({
        where: { userId },
      }),
      this.prisma.progress.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    return JSON.stringify({
      success: true,
      action: 'detail',
      user: {
        id: user.id,
        email: user.email,
        name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        profile: user.Profile
          ? {
              studyStreak: user.Profile.studyStreak,
              totalStudyTime: user.Profile.totalStudyTime,
              currentLevel: user.Profile.currentLevel,
            }
          : null,
      },
      stats: {
        submissionCount,
        progressCount,
        lastActivity: lastActivity?.updatedAt || null,
        classesAsStudent: user.classroomsStudying.length,
        classesAsTeacher: user.classroomsTeaching.length,
      },
      classes:
        user.role === 'teacher'
          ? user.classroomsTeaching.map((c) => ({ id: c.id, name: c.name }))
          : user.classroomsStudying.map((cs) => ({
              id: cs.classroom.id,
              name: cs.classroom.name,
            })),
    });
  }

  private async getUserStats(role: string): Promise<string> {
    const whereClause: any = role !== 'all' ? { role: role as UserRole } : {};

    // Count by role
    const [total, students, teachers, parents, admins, active, inactive] =
      await Promise.all([
        this.prisma.user.count({ where: whereClause }),
        this.prisma.user.count({ where: { role: UserRole.student } }),
        this.prisma.user.count({ where: { role: UserRole.teacher } }),
        this.prisma.user.count({ where: { role: UserRole.parent } }),
        this.prisma.user.count({ where: { role: UserRole.admin } }),
        this.prisma.user.count({ where: { ...whereClause, status: 'active' } }),
        this.prisma.user.count({
          where: { ...whereClause, status: { not: 'active' } },
        }),
      ]);

    // Recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRegistrations = await this.prisma.user.count({
      where: {
        ...whereClause,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Active in last 7 days
    const activeRecently = await this.prisma.user.count({
      where: {
        ...whereClause,
        lastLoginAt: { gte: sevenDaysAgo },
      },
    });

    return JSON.stringify({
      success: true,
      action: 'stats',
      filterRole: role,
      stats: {
        total,
        byRole: {
          students,
          teachers,
          parents,
          admins,
        },
        byStatus: {
          active,
          inactive,
        },
        activity: {
          newLast7Days: recentRegistrations,
          activeLast7Days: activeRecently,
        },
      },
      summary: `Tổng ${total} user: ${students} học sinh, ${teachers} giáo viên, ${parents} phụ huynh, ${admins} admin. ${recentRegistrations} đăng ký mới trong 7 ngày qua.`,
    });
  }

  private async getRecentUsers(
    role: string,
    limit: number,
    period?: string,
  ): Promise<string> {
    const dateFilter = this.getDateFilter(period || '7d');

    const whereClause: any = {
      createdAt: { gte: dateFilter },
    };
    if (role !== 'all') {
      whereClause.role = role;
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return JSON.stringify({
      success: true,
      action: 'recent',
      period: period || '7d',
      role,
      count: users.length,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.displayName || 'N/A',
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
      })),
    });
  }

  private getDateFilter(period: string): Date {
    const now = new Date();
    switch (period) {
      case '1d':
        return new Date(now.setDate(now.getDate() - 1));
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      case '90d':
        return new Date(now.setDate(now.getDate() - 90));
      default:
        return new Date(now.setDate(now.getDate() - 7));
    }
  }
}
