import { PrismaRepository } from '@app/database';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable } from '@nestjs/common';
import { Classroom, Prisma } from '@prisma/client';
import { Readable } from 'stream';
import { FilterClassroomRequestDto } from '../dto/classroom.dto';

@Injectable()
export class ClassroomRepository {
    constructor(private readonly prisma: PrismaRepository) { }

    async create(data: Prisma.ClassroomCreateInput): Promise<Classroom> {
        return this.prisma.classroom.create({ data });
    }

    async findById(id: string): Promise<Classroom | null> {
        return this.prisma.classroom.findUnique({ where: { id }, include: { students: true, teacher: true } });
    }

    async update(id: string, data: Prisma.ClassroomUpdateInput): Promise<Classroom> {
        return this.prisma.classroom.update({ where: { id }, data });
    }

    async delete(id: string): Promise<Classroom> {
        return this.prisma.classroom.delete({ where: { id } });
    }

    async list(params: FilterClassroomRequestDto): Promise<PageResponseDto<Classroom>> {
        const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc', teacherId } = params;

        const where: Prisma.ClassroomWhereInput = {
            teacherId,
            name: search ? { contains: search, mode: 'insensitive' } : undefined,
        };

        const totalItems = await this.prisma.classroom.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));
        const safePage = Math.min(Math.max(page, 1), totalPages);

        const data = await this.prisma.classroom.findMany({
            where,
            skip: (safePage - 1) * limit,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            include: { students: true, teacher: true },
        });

        return PageResponseDto.of(data, safePage, limit, totalItems);
    }

    async addStudent(classroomId: string, studentId: string) {
        return this.prisma.classroomStudent.create({
            data: {
                classroomId,
                studentId,
            },
        });
    }


    async removeStudent(classroomId: string, studentId: string) {
        return this.prisma.classroomStudent.delete({
            where: { classroomId_studentId: { classroomId, studentId } },
        });
    }

    streamAll(params: FilterClassroomRequestDto): Readable {
        const { search, sortBy = 'createdAt', sortOrder = 'desc', teacherId } = params;
        const where: Prisma.ClassroomWhereInput = {
            teacherId,
            name: search ? { contains: search, mode: 'insensitive' } : undefined,
        };

        const batchSize = 100;
        let cursor: string | undefined;

        const stream = new Readable({ objectMode: true, read() { } });

        const fetchData = async () => {
            const results = await this.prisma.classroom.findMany({
                where,
                take: batchSize,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { id: cursor } : undefined,
                orderBy: { [sortBy]: sortOrder },
                include: { students: true, teacher: true },
            });

            if (results.length === 0) {
                stream.push(null);
                return;
            }

            for (const item of results) {
                stream.push(item);
            }

            cursor = results[results.length - 1].id;
            fetchData();
        };

        fetchData().catch(err => stream.emit('error', err));

        return stream;
    }
}
