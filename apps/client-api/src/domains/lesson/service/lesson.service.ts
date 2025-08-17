import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Lesson } from '@prisma/client';
import { CreateLessonDto, FilterLessonRequestDto, UpdateLessonDto } from '../dto/lesson.dto';
import { LessonRepository } from '../repository/lesson.repository';

@Injectable()
export class LessonService {
    constructor(private readonly lessonRepository: LessonRepository) { }

    async create(dto: CreateLessonDto): Promise<Lesson> {
        return this.lessonRepository.create(dto);
    }

    async findById(id: string): Promise<Lesson> {
        const lesson = await this.lessonRepository.findById(id);
        if (!lesson) {
            throw new NotFoundException(`Lesson with id ${id} not found`);
        }
        return lesson;
    }

    async update(id: string, dto: UpdateLessonDto): Promise<Lesson> {
        await this.ensureExists(id);
        return this.lessonRepository.update(id, dto);
    }

    async delete(id: string): Promise<Lesson> {
        await this.ensureExists(id);
        return this.lessonRepository.delete(id);
    }

    async list(params: FilterLessonRequestDto): Promise<PageResponseDto<Lesson>> {
        return this.lessonRepository.list(params);
    }

    private async ensureExists(id: string): Promise<void> {
        const exists = await this.lessonRepository.findById(id);
        if (!exists) {
            throw new NotFoundException(`Lesson with id ${id} not found`);
        }
    }
}