import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { User, Prisma, UserRole } from '@prisma/client';
import { FilterTeacherRequestDto } from '../dto/teacher.dto';

const teacherSelect = {
    id: true,
    email: true,
    phone: true,
    username: true,
    role: true,
    status: true,
    provider: true,
    providerId: true,
    firstName: true,
    lastName: true,
    displayName: true,
    gender: true,
    dob: true,
    nationality: true,
    nativeLanguage: true,
    avatarUrl: true,
    bio: true,
    language: true,
    timezone: true,
    lastLoginAt: true,
    lastActiveAt: true,
    emailVerified: true,
    phoneVerified: true,
    twoFactorEnabled: true,
    preferences: true,
    privacySettings: true,
    notificationSettings: true,
    parentalConsent: true,
    profileCompleteness: true,
    isOnline: true,
    createdAt: true,
    updatedAt: true,
};

@Injectable()
export class TeacherRepository {
    constructor(private readonly prisma: PrismaRepository) { }

    async create(data: Prisma.UserCreateInput): Promise<User> {
        return this.prisma.user.create({ data, select: teacherSelect });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { email }, select: teacherSelect });
    }

    async findById(id: string): Promise<User | null> {
        return this.prisma.user.findFirst({ where: { id, role: UserRole.teacher }, select: teacherSelect });
    }

    async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
        return this.prisma.user.update({ where: { id }, data, select: teacherSelect });
    }

    async delete(id: string): Promise<User> {
        return this.prisma.user.delete({ where: { id }, select: teacherSelect });
    }

    async list(params: FilterTeacherRequestDto): Promise<PageResponseDto<User>> {
        const {
            page = 1,
            limit = 10,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = params;

        const where: Prisma.UserWhereInput = {
            role: UserRole.teacher,
            OR: search
                ? [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ]
                : undefined,
        };

        const totalItems = await this.prisma.user.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));
        const safePage = Math.min(Math.max(page, 1), totalPages);

        const data = await this.prisma.user.findMany({
            where,
            skip: (safePage - 1) * limit,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            select: teacherSelect
        });

        return PageResponseDto.of(data, safePage, limit, totalItems);
    }
}
