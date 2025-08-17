import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Progress } from '@prisma/client';
import { CreateProgressDto, FilterProgressRequestDto, UpdateProgressDto } from '../dto/progress.dto';
import { ProgressRepository } from '../repository/progress.repository';

@Injectable()
export class ProgressService {
    constructor(private readonly progressRepository: ProgressRepository) { }

    async create(dto: CreateProgressDto): Promise<Progress> {
        return this.progressRepository.create(dto);
    }

    async findById(id: string): Promise<Progress> {
        const progress = await this.progressRepository.findById(id);
        if (!progress) {
            throw new NotFoundException(`Progress with id ${id} not found`);
        }
        return progress;
    }

    async update(id: string, dto: UpdateProgressDto): Promise<Progress> {
        await this.ensureExists(id);
        return this.progressRepository.update(id, dto);
    }

    async delete(id: string): Promise<Progress> {
        await this.ensureExists(id);
        return this.progressRepository.delete(id);
    }

    async list(params: FilterProgressRequestDto): Promise<PageResponseDto<Progress>> {
        return this.progressRepository.list(params);
    }

    private async ensureExists(id: string): Promise<void> {
        const exists = await this.progressRepository.findById(id);
        if (!exists) {
            throw new NotFoundException(`Progress with id ${id} not found`);
        }
    }
}
