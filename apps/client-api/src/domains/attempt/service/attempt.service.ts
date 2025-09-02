import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Attempt } from '@prisma/client';
import {
  CreateAttemptDto,
  FilterAttemptRequestDto,
  UpdateAttemptDto,
} from '../dto/attempt.dto';
import { AttemptRepository } from '../repository/attempt.repository';

@Injectable()
export class AttemptService {
  constructor(private readonly attemptRepository: AttemptRepository) {}

  async create(dto: CreateAttemptDto): Promise<Attempt> {
    return this.attemptRepository.create(dto);
  }

  async findById(id: string): Promise<Attempt> {
    const attempt = await this.attemptRepository.findById(id);
    if (!attempt) {
      throw new NotFoundException(`Attempt with id ${id} not found`);
    }
    return attempt;
  }

  async update(id: string, dto: UpdateAttemptDto): Promise<Attempt> {
    await this.ensureExists(id);
    return this.attemptRepository.update(id, dto);
  }

  async delete(id: string): Promise<Attempt> {
    await this.ensureExists(id);
    return this.attemptRepository.delete(id);
  }

  async list(
    params: FilterAttemptRequestDto,
  ): Promise<PageResponseDto<Attempt>> {
    return this.attemptRepository.list(params);
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.attemptRepository.findById(id);
    if (!exists) {
      throw new NotFoundException(`Attempt with id ${id} not found`);
    }
  }
}
