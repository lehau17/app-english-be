import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { FilterStudentRequestDto } from '../dto/student.dto';

@Injectable()
export class StudentRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        role: 'student',
      },
    });
  }

  /**
   * Get student by id
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, role: 'student' },
    });
  }

  /**
   * Update student
   */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, role: 'student' },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { phone, role: 'student' },
    });
  }

  async checkExistContrants(email: string, phone: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
        role: 'student',
      },
    });
    return !!user;
  }

  /**
   * Delete student (soft delete có thể dùng status=inative)
   */
  async delete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status: 'inactive' },
    });
  }

  /**
   * List students with pagination (PageResponseDto)
   */
  async list(params: FilterStudentRequestDto): Promise<PageResponseDto<User>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt', // default sort field
      sortOrder = 'desc', // default sort order
      status,
      gender,
      phone,
    } = params;

    const where: Prisma.UserWhereInput = {
      role: 'student',
      ...(status && { status }),
      ...(gender && { gender }),
      ...(phone && { phone: { contains: phone, mode: 'insensitive' } }),
      OR: search
        ? [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    // Count total items
    const totalItems = await this.prisma.user.count({ where });

    // Calculate pagination
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    const allowedSortFields: (keyof User)[] = [
      'id',
      'createdAt',
      'updatedAt',
      'firstName',
      'lastName',
      'email',
      'lastLoginAt',
    ];
    const sortField = allowedSortFields.includes(sortBy as keyof User)
      ? sortBy
      : 'createdAt';
    const sortDirection: Prisma.SortOrder = sortOrder;

    const data = await this.prisma.user.findMany({
      where,
      skip: (safePage - 1) * limit,
      take: limit,
      orderBy: { [sortField]: sortDirection },
    });

    return PageResponseDto.of(data, safePage, limit, totalItems);
  }

  /**
   * List all students (for export)
   */
  async listAll(params: FilterStudentRequestDto): Promise<User[]> {
    const {
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      gender,
      phone,
    } = params;

    const where: Prisma.UserWhereInput = {
      role: 'student',
      ...(status && { status }),
      ...(gender && { gender }),
      ...(phone && { phone: { contains: phone, mode: 'insensitive' } }),
      OR: search
        ? [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const allowedSortFields: (keyof User)[] = [
      'id',
      'createdAt',
      'updatedAt',
      'firstName',
      'lastName',
      'email',
      'lastLoginAt',
    ];
    const sortField = allowedSortFields.includes(sortBy as keyof User)
      ? sortBy
      : 'createdAt';
    const sortDirection: Prisma.SortOrder = sortOrder;

    return this.prisma.user.findMany({
      where,
      orderBy: { [sortField]: sortDirection },
    });
  }

  /**
   * Bulk delete students (soft delete)
   */
  async bulkDelete(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.user.updateMany({
      where: {
        id: { in: ids },
        role: 'student',
      },
      data: { status: 'inactive' },
    });
    return { count: result.count };
  }

  /**
   * Get student statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byGender: Record<string, number>;
  }> {
    const [total, active, inactive, byGender] = await Promise.all([
      this.prisma.user.count({ where: { role: 'student' } }),
      this.prisma.user.count({ where: { role: 'student', status: 'active' } }),
      this.prisma.user.count({
        where: { role: 'student', status: 'inactive' },
      }),
      this.prisma.user.groupBy({
        by: ['gender'],
        where: { role: 'student' },
        _count: true,
      }),
    ]);

    const genderStats: Record<string, number> = {};
    byGender.forEach((item) => {
      genderStats[item.gender || 'unknown'] = item._count;
    });

    return {
      total,
      active,
      inactive,
      byGender: genderStats,
    };
  }
}
