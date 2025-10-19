import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
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
    constructor(private readonly prisma: PrismaRepository) { }

    async getParents(query: ParentListQueryDto) {
        const {
            page = 1,
            limit = 20,
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

        const totalItems = await this.prisma.user.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));
        const safePage = Math.min(Math.max(page, 1), totalPages);

        const parents = await this.prisma.user.findMany({
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
            orderBy: { [sortBy]: sortOrder },
            skip: (safePage - 1) * limit,
            take: limit,
        });

        const data = parents.map((parent) => ({
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
}
