import { PrismaRepository } from '@app/database';
import { ExcelExportService } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  AssignParentDto,
  CreateParentDto,
  ParentListQueryDto,
  UpdateParentDto,
} from '../dto';

@Injectable()
export class AdminParentService {
  constructor(
    private readonly prisma: PrismaRepository,
    private readonly excelExportService: ExcelExportService,
  ) { }

  async getParents(query: ParentListQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      minChildren,
      maxChildren,
      createdFrom,
      createdTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: any = {
      role: UserRole.parent,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.status = isActive ? 'active' : 'inactive';
    }

    // Date range filter
    if (createdFrom || createdTo) {
      where.createdAt = {};
      if (createdFrom) {
        where.createdAt.gte = new Date(createdFrom);
      }
      if (createdTo) {
        where.createdAt.lte = new Date(createdTo);
      }
    }

    // Get all parents matching basic filters (before children count filter)
    const allParents = await this.prisma.user.findMany({
      where,
      include: {
        parentRelations: {
          include: {
            child: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            parentRelations: true,
          },
        },
      },
    });

    // Filter by children count (post-query filter)
    let filteredParents = allParents;
    if (minChildren !== undefined || maxChildren !== undefined) {
      filteredParents = allParents.filter((parent) => {
        const childrenCount = parent._count.parentRelations;
        if (minChildren !== undefined && childrenCount < minChildren) {
          return false;
        }
        if (maxChildren !== undefined && childrenCount > maxChildren) {
          return false;
        }
        return true;
      });
    }

    // Sort filtered results
    filteredParents.sort((a, b) => {
      const aValue = a[sortBy as keyof typeof a];
      const bValue = b[sortBy as keyof typeof b];
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    // Pagination
    const totalItems = filteredParents.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const paginatedParents = filteredParents.slice(
      (safePage - 1) * limit,
      safePage * limit,
    );

    const data = paginatedParents.map((parent) => ({
      id: parent.id,
      email: parent.email,
      firstName: parent.firstName,
      lastName: parent.lastName,
      displayName: parent.displayName,
      phoneNumber: parent.phone,
      experience: parent.experience,
      highlights: parent.highlights,
      address: null, // User model doesn't have address field
      avatarUrl: parent.avatarUrl,
      isActive: parent.status === 'active',
      childrenCount: parent._count.parentRelations,
      children: parent.parentRelations.map((pc) => ({
        id: pc.child.id,
        name:
          pc.child.displayName ||
          `${pc.child.firstName} ${pc.child.lastName}`.trim() ||
          pc.child.email,
        email: pc.child.email,
        avatarUrl: pc.child.avatarUrl,
      })),
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
    }));

    return PageResponseDto.of(data, safePage, limit, totalItems);
  }

  async getParentById(id: string) {
    const parent = await this.prisma.user.findFirst({
      where: {
        id,
        role: UserRole.parent,
      },
      include: {
        parentRelations: {
          include: {
            child: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                email: true,
                avatarUrl: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    return {
      id: parent.id,
      email: parent.email,
      firstName: parent.firstName,
      lastName: parent.lastName,
      displayName: parent.displayName,
      phoneNumber: parent.phone,
      experience: parent.experience,
      highlights: parent.highlights,
      address: null, // User model doesn't have address field
      avatarUrl: parent.avatarUrl,
      isActive: parent.status === 'active',
      children: parent.parentRelations.map((pc) => ({
        id: pc.child.id,
        name:
          pc.child.displayName ||
          `${pc.child.firstName} ${pc.child.lastName}`.trim() ||
          pc.child.email,
        email: pc.child.email,
        avatarUrl: pc.child.avatarUrl,
        isActive: pc.child.status === 'active',
        assignedAt: pc.createdAt,
      })),
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
    };
  }

  async createParent(dto: CreateParentDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const parent = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        displayName: dto.displayName || `${dto.firstName} ${dto.lastName}`,
        phone: dto.phoneNumber,
        experience: dto.experience,
        highlights: dto.highlights,
        role: UserRole.parent,
        status: 'active',
      },
    });

    return {
      id: parent.id,
      email: parent.email,
      firstName: parent.firstName,
      lastName: parent.lastName,
      displayName: parent.displayName,
      phoneNumber: parent.phone,
      experience: parent.experience,
      highlights: parent.highlights,
      address: null, // User model doesn't have address field
      isActive: parent.status === 'active',
      createdAt: parent.createdAt,
    };
  }

  async updateParent(id: string, dto: UpdateParentDto) {
    const parent = await this.prisma.user.findFirst({
      where: {
        id,
        role: UserRole.parent,
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    // Transform DTO to match User model fields
    const updateData: any = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
    if (dto.phoneNumber !== undefined) updateData.phone = dto.phoneNumber;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;
    if (dto.experience !== undefined) updateData.experience = dto.experience;
    if (dto.highlights !== undefined) updateData.highlights = dto.highlights;
    // Note: address field doesn't exist in User model, so we skip it

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      displayName: updated.displayName,
      phoneNumber: updated.phone,
      experience: updated.experience,
      highlights: updated.highlights,
      address: null, // User model doesn't have address field
      avatarUrl: updated.avatarUrl,
      isActive: updated.status === 'active',
      updatedAt: updated.updatedAt,
    };
  }

  async deleteParent(id: string) {
    const parent = await this.prisma.user.findFirst({
      where: {
        id,
        role: UserRole.parent,
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    // Remove all parent-child relationships first
    await this.prisma.parentChild.deleteMany({
      where: { parentId: id },
    });

    // Delete custom rewards
    await this.prisma.customReward.deleteMany({
      where: { parentId: id },
    });

    // Delete the parent user
    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'Parent deleted successfully' };
  }

  async assignChildren(parentId: string, dto: AssignParentDto) {
    const parent = await this.prisma.user.findFirst({
      where: {
        id: parentId,
        role: UserRole.parent,
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    // Verify all students exist and are students
    const students = await this.prisma.user.findMany({
      where: {
        id: { in: dto.studentIds },
        role: UserRole.student,
      },
    });

    if (students.length !== dto.studentIds.length) {
      throw new NotFoundException('Some students not found or not valid');
    }

    // Remove existing relationships
    await this.prisma.parentChild.deleteMany({
      where: { parentId },
    });

    // Create new relationships
    const parentChildRelations = await this.prisma.parentChild.createMany({
      data: dto.studentIds.map((studentId) => ({
        parentId,
        childId: studentId,
        canViewProgress: true,
        canSetGoals: true,
        canControlTime: false,
        notificationsEnabled: true,
      })),
      skipDuplicates: true,
    });

    return {
      message: 'Children assigned successfully',
      assignedCount: parentChildRelations.count,
    };
  }

  async getParentChildren(parentId: string) {
    const parent = await this.prisma.user.findFirst({
      where: {
        id: parentId,
        role: UserRole.parent,
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    const children = await this.prisma.parentChild.findMany({
      where: { parentId },
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    return children.map((pc) => ({
      id: pc.child.id,
      name:
        pc.child.displayName ||
        `${pc.child.firstName} ${pc.child.lastName}`.trim() ||
        pc.child.email,
      email: pc.child.email,
      avatarUrl: pc.child.avatarUrl,
      isActive: pc.child.status === 'active',
      assignedAt: pc.createdAt,
      canViewProgress: pc.canViewProgress,
      canSetGoals: pc.canSetGoals,
      canControlTime: pc.canControlTime,
    }));
  }

  async removeChildFromParent(parentId: string, childId: string) {
    const relation = await this.prisma.parentChild.findUnique({
      where: {
        parentId_childId: { parentId, childId },
      },
    });

    if (!relation) {
      throw new NotFoundException('Parent-child relationship not found');
    }

    await this.prisma.parentChild.delete({
      where: {
        parentId_childId: { parentId, childId },
      },
    });

    return { message: 'Child removed from parent successfully' };
  }

  async getAvailableStudents(search?: string) {
    const where: any = {
      role: UserRole.student,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const students = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to prevent too many results
    });

    return students.map((student) => ({
      id: student.id,
      name:
        student.displayName ||
        `${student.firstName} ${student.lastName}`.trim() ||
        student.email,
      email: student.email,
      avatarUrl: student.avatarUrl,
      createdAt: student.createdAt,
    }));
  }

  async toggleParentStatus(id: string) {
    const parent = await this.prisma.user.findFirst({
      where: {
        id,
        role: UserRole.parent,
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    const newStatus = parent.status === 'active' ? 'inactive' : 'active';
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: newStatus },
    });

    return {
      id: updated.id,
      isActive: updated.status === 'active',
      message: `Parent ${updated.status === 'active' ? 'activated' : 'deactivated'} successfully`,
    };
  }

  async bulkDelete(ids: string[]): Promise<{ count: number }> {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Parent IDs are required');
    }

    // Remove all parent-child relationships first
    await this.prisma.parentChild.deleteMany({
      where: { parentId: { in: ids } },
    });

    // Delete custom rewards
    await this.prisma.customReward.deleteMany({
      where: { parentId: { in: ids } },
    });

    // Delete the parent users
    const result = await this.prisma.user.deleteMany({
      where: {
        id: { in: ids },
        role: UserRole.parent,
      },
    });

    return { count: result.count };
  }

  async bulkActivate(ids: string[]): Promise<{ count: number }> {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Parent IDs are required');
    }

    const result = await this.prisma.user.updateMany({
      where: {
        id: { in: ids },
        role: UserRole.parent,
      },
      data: { status: 'active' },
    });

    return { count: result.count };
  }

  async bulkDeactivate(ids: string[]): Promise<{ count: number }> {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Parent IDs are required');
    }

    const result = await this.prisma.user.updateMany({
      where: {
        id: { in: ids },
        role: UserRole.parent,
      },
      data: { status: 'inactive' },
    });

    return { count: result.count };
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    withChildren: number;
    withoutChildren: number;
    avgChildrenPerParent: number;
  }> {
    const [total, active, inactive, parentsWithChildren] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.parent } }),
      this.prisma.user.count({
        where: { role: UserRole.parent, status: 'active' },
      }),
      this.prisma.user.count({
        where: { role: UserRole.parent, status: 'inactive' },
      }),
      this.prisma.user.findMany({
        where: { role: UserRole.parent },
        include: {
          _count: {
            select: {
              parentRelations: true,
            },
          },
        },
      }),
    ]);

    const withChildren = parentsWithChildren.filter(
      (p) => p._count.parentRelations > 0,
    ).length;
    const withoutChildren = total - withChildren;

    const totalChildren = parentsWithChildren.reduce(
      (sum, p) => sum + p._count.parentRelations,
      0,
    );
    const avgChildrenPerParent =
      total > 0 ? Number((totalChildren / total).toFixed(2)) : 0;

    return {
      total,
      active,
      inactive,
      withChildren,
      withoutChildren,
      avgChildrenPerParent,
    };
  }

  async exportParents(query: ParentListQueryDto): Promise<Buffer> {
    const parents = await this.getParentsForExport(query);
    if (parents.length === 0) {
      return this.excelExportService.generateExcel(
        [],
        [{ header: 'Email', key: 'email', width: 30 }],
        'Danh sách phụ huynh',
      );
    }

    const data = parents.map((p) => ({
      email: p.email || '',
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      phoneNumber: p.phoneNumber || '',
      displayName: p.displayName || '',
      isActive: p.isActive,
      childrenCount: p.childrenCount || 0,
      createdAt: p.createdAt,
    }));

    return this.excelExportService.generateExcel(
      data,
      [
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Họ', key: 'firstName', width: 15 },
        { header: 'Tên', key: 'lastName', width: 15 },
        { header: 'Số điện thoại', key: 'phoneNumber', width: 15 },
        { header: 'Tên hiển thị', key: 'displayName', width: 20 },
        { header: 'Hoạt động', key: 'isActive', width: 12 },
        { header: 'Số con', key: 'childrenCount', width: 10 },
        { header: 'Ngày tạo', key: 'createdAt', width: 18 },
      ],
      'Danh sách phụ huynh',
    );
  }

  getImportTemplate(): string {
    const header =
      'email,password,firstName,lastName,phoneNumber,displayName\n';
    const exampleRows = [
      'parent1@example.com,Password123!,Nguyen,Van A,0901234567,Nguyen Van A',
      'parent2@example.com,Password123!,Tran,Thi B,0912345678,Tran Thi B',
    ].join('\n');

    return header + exampleRows;
  }

  async importParents(
    fileBuffer: Buffer,
  ): Promise<{ created: number; errors: any[] }> {
    const fileContent = fileBuffer.toString('utf-8');
    const rows = fileContent
      .split('\n')
      .map((row) => row.trim())
      .filter((row) => row);
    if (rows.length < 2) {
      throw new BadRequestException(
        'CSV file must have a header and at least one data row.',
      );
    }

    const header = rows[0].split(',').map((h) => h.trim());
    const emailIndex = header.indexOf('email');
    const passwordIndex = header.indexOf('password');
    const firstNameIndex = header.indexOf('firstName');
    const lastNameIndex = header.indexOf('lastName');
    const phoneNumberIndex = header.indexOf('phoneNumber');
    const displayNameIndex = header.indexOf('displayName');

    if (
      emailIndex === -1 ||
      passwordIndex === -1 ||
      firstNameIndex === -1 ||
      lastNameIndex === -1
    ) {
      throw new BadRequestException(
        'CSV header must contain email, password, firstName, lastName',
      );
    }

    const parentsToCreate: CreateParentDto[] = [];
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i].split(',');
      const email = values[emailIndex]?.trim();
      const password = values[passwordIndex]?.trim();
      const firstName = values[firstNameIndex]?.trim();
      const lastName = values[lastNameIndex]?.trim();
      const phoneNumber = values[phoneNumberIndex]?.trim();
      const displayName =
        values[displayNameIndex]?.trim() ||
        `${firstName} ${lastName}`.trim();

      if (email && password && firstName && lastName) {
        parentsToCreate.push({
          email,
          password,
          firstName,
          lastName,
          phoneNumber,
          displayName,
        });
      } else {
        errors.push({ row: i + 1, error: 'Missing required fields' });
      }
    }

    let createdCount = 0;
    for (const parentDto of parentsToCreate) {
      try {
        await this.createParent(parentDto);
        createdCount++;
      } catch (error) {
        errors.push({ parent: parentDto.email, error: error.message });
      }
    }

    return { created: createdCount, errors };
  }

  private async getParentsForExport(query: ParentListQueryDto) {
    const {
      search,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: any = {
      role: UserRole.parent,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.status = isActive ? 'active' : 'inactive';
    }

    const parents = await this.prisma.user.findMany({
      where,
      include: {
        _count: {
          select: {
            parentRelations: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
    });

    return parents.map((parent) => ({
      email: parent.email,
      firstName: parent.firstName,
      lastName: parent.lastName,
      phoneNumber: parent.phone,
      displayName: parent.displayName,
      isActive: parent.status === 'active',
      childrenCount: parent._count.parentRelations,
      createdAt: parent.createdAt,
    }));
  }
}
