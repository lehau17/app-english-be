import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { CreateTeacherDto, FilterTeacherRequestDto, UpdateTeacherDto } from '../dto/teacher.dto';
import { TeacherRepository } from '../repository/teacher.repository';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TeacherService {
    constructor(private readonly teacherRepository: TeacherRepository) { }

    async create(dto: CreateTeacherDto): Promise<User> {
        const existingTeacher = await this.teacherRepository.findByEmail(dto.email);
        if (existingTeacher) {
            throw new BadRequestException('Teacher with this email already exists');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        return this.teacherRepository.create({ ...dto, passwordHash, role: UserRole.teacher });
    }

    async findById(id: string): Promise<User> {
        const teacher = await this.teacherRepository.findById(id);
        if (!teacher || teacher.role !== UserRole.teacher) {
            throw new NotFoundException(`Teacher with id ${id} not found`);
        }
        return teacher;
    }

    async update(id: string, dto: UpdateTeacherDto): Promise<User> {
        await this.findById(id);
        return this.teacherRepository.update(id, dto);
    }

    async delete(id: string): Promise<User> {
        await this.findById(id);
        return this.teacherRepository.delete(id);
    }

    async list(params: FilterTeacherRequestDto): Promise<PageResponseDto<User>> {
        return this.teacherRepository.list(params);
    }
}
