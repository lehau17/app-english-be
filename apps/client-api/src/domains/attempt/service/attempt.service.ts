import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Attempt } from '@prisma/client';
import { GeminiService } from '@app/shared';
import {
  CreateAttemptDto,
  FilterAttemptRequestDto,
  UpdateAttemptDto,
} from '../dto/attempt.dto';
import { AttemptRepository } from '../repository/attempt.repository';

@Injectable()
export class AttemptService {
  private readonly logger = new Logger(AttemptService.name);

  constructor(
    private readonly attemptRepository: AttemptRepository,
    private readonly geminiService: GeminiService,
  ) {}

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

    // Nếu có score mới, kiểm tra xem có cần tạo feedback AI không
    if (dto.score !== undefined) {
      const currentAttempt = await this.attemptRepository.findById(id);
      if (currentAttempt && currentAttempt.maxScore) {
        // Chỉ tạo feedback AI nếu score < maxScore
        if (dto.score < currentAttempt.maxScore) {
          try {
            const feedback = await this.geminiService.generateAttemptFeedback({
              score: dto.score,
              maxScore: currentAttempt.maxScore,
              timeSpent: currentAttempt.timeSpent,
              userAnswers: currentAttempt.detail as any,
            });

            // Gán feedback vào dto
            dto.feedback = feedback;
            this.logger.log(
              `Đã tạo feedback AI cho attempt ${id}: ${dto.score}/${currentAttempt.maxScore}`,
            );
          } catch (error) {
            this.logger.error(`Lỗi tạo feedback AI cho attempt ${id}:`, error);
            // Vẫn tiếp tục update mà không có feedback AI
          }
        } else {
          // Đạt điểm tối đa - có thể set feedback mặc định
          dto.feedback = 'Hoàn hảo! Bạn đã đạt điểm tối đa. Tiếp tục phát huy!';
        }
      }
    }

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
