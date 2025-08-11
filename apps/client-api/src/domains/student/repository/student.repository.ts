import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { FilterStudentRequestDto } from '../dto/student.dto';


@Injectable()
export class StudentRepository {
    constructor(private readonly prisma: PrismaRepository) { }

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


    async findByUsername(username: string): Promise<User | null> {
        return this.prisma.user.findFirst({
            where: { username, role: 'student' },
        });
    }

    async findByPhone(phone: string): Promise<User | null> {
        return this.prisma.user.findFirst({
            where: { phone, role: 'student' },
        });
    }

    async checkExistContrants(email: string, phone: string, username: string) {
        const user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { phone },
                    { username },
                ], role: 'student'
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
            sortOrder = 'desc',   // default sort order
        } = params;

        const where: Prisma.UserWhereInput = {
            role: 'student',
            OR: search
                ? [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { username: { contains: search, mode: 'insensitive' } },
                ]
                : undefined,
        };

        // Count total items
        const totalItems = await this.prisma.user.count({ where });

        // Calculate pagination
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));
        const safePage = Math.min(Math.max(page, 1), totalPages);

        const allowedSortFields: (keyof User)[] = [
            "id",
            'createdAt',
            'updatedAt',
            'firstName',
            'lastName',
            'email',
            'username',
            'lastLoginAt',
        ];
        const sortField = allowedSortFields.includes(sortBy as keyof User)
            ? sortBy
            : 'createdAt';
        const sortDirection: Prisma.SortOrder =
            sortOrder;

        const data = await this.prisma.user.findMany({
            where,
            skip: (safePage - 1) * limit,
            take: limit,
            orderBy: { [sortField]: sortDirection },
        });

        return PageResponseDto.of(data, safePage, limit, totalItems);
    }

}
