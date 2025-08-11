
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Course } from '@prisma/client';
import { CreateCourseDto, FilterCourseRequestDto, UpdateCourseDto } from '../dto/course.dto';
import { CourseRepository } from '../repository/course.repository';

@Injectable()
export class CourseService {
    constructor(private readonly courseRepository: CourseRepository) { }

    async create(dto: CreateCourseDto): Promise<Course> {
        return this.courseRepository.create(dto);
    }

    async findById(id: string): Promise<Course> {
        const course = await this.courseRepository.findById(id);
        if (!course) {
            throw new NotFoundException(`Course with id ${id} not found`);
        }
        return course;
    }

    async update(id: string, dto: UpdateCourseDto): Promise<Course> {
        await this.ensureExists(id);
        return this.courseRepository.update(id, dto);
    }

    async delete(id: string): Promise<Course> {
        await this.ensureExists(id);
        return this.courseRepository.delete(id);
    }

    async list(params: FilterCourseRequestDto): Promise<PageResponseDto<Course>> {
        return this.courseRepository.list(params);
    }

    private async ensureExists(id: string): Promise<void> {
        const exists = await this.courseRepository.findById(id);
        if (!exists) {
            throw new NotFoundException(`Course with id ${id} not found`);
        }
    }
}
