import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export enum ReviewMode {
  FLASHCARD = 'flashcard',
  QUIZ = 'quiz',
  TYPING = 'typing',
}

export class ReviewSubmissionDto {
  @ApiProperty({ description: 'ID của vocabulary term' })
  @IsString()
  termId: string;

  @ApiProperty({
    description: 'Đánh giá chất lượng (0=forgot, 1-2=hard, 3-4=good, 5=easy)',
    minimum: 0,
    maximum: 5,
  })
  @IsInt()
  @Min(0)
  @Max(5)
  quality: number;
}

export class StartReviewSessionDto {
  @ApiPropertyOptional({ description: 'ID của vocabulary list (optional)' })
  @IsOptional()
  @IsString()
  listId?: string;

  @ApiPropertyOptional({ description: 'ID của vocabulary unit (optional)' })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiProperty({
    description: 'Chế độ review',
    enum: ReviewMode,
    default: ReviewMode.FLASHCARD,
  })
  @IsEnum(ReviewMode)
  mode: ReviewMode;

  @ApiPropertyOptional({
    description: 'Số lượng card tối đa trong session',
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Có bao gồm từ mới không',
    default: true,
  })
  @IsOptional()
  includeNew?: boolean;

  @ApiPropertyOptional({
    description: 'Có bao gồm từ cần ôn tập không',
    default: true,
  })
  @IsOptional()
  includeReview?: boolean;
}

export class SubmitReviewDto {
  @ApiProperty({
    description: 'Danh sách kết quả review',
    type: [ReviewSubmissionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewSubmissionDto)
  reviews: ReviewSubmissionDto[];

  @ApiPropertyOptional({ description: 'ID của vocabulary list (optional)' })
  @IsOptional()
  @IsString()
  listId?: string;

  @ApiPropertyOptional({
    description: 'Chế độ review',
    enum: ReviewMode,
  })
  @IsOptional()
  @IsEnum(ReviewMode)
  mode?: ReviewMode;

  @ApiPropertyOptional({ description: 'Thời gian học (giây)' })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({
    description:
      'Incremental submission flag (true = per-card, false = session complete)',
  })
  @IsOptional()
  @IsBoolean()
  partial?: boolean;

  @ApiPropertyOptional({
    description:
      'Finalize session flag (true = send notifications, create session record)',
  })
  @IsOptional()
  @IsBoolean()
  finalize?: boolean;
}

export class ReviewStatsDto {
  @ApiProperty({ description: 'Tổng số từ' })
  @IsInt()
  @Min(0)
  totalTerms: number;

  @ApiProperty({ description: 'Số từ mới' })
  @IsInt()
  @Min(0)
  newCount: number;

  @ApiProperty({ description: 'Số từ đang học' })
  @IsInt()
  @Min(0)
  learningCount: number;

  @ApiProperty({ description: 'Số từ đang ôn tập' })
  @IsInt()
  @Min(0)
  reviewCount: number;

  @ApiProperty({ description: 'Số từ đã thành thạo' })
  @IsInt()
  @Min(0)
  masteredCount: number;

  @ApiProperty({ description: 'Số từ cần ôn hôm nay' })
  @IsInt()
  @Min(0)
  dueToday: number;

  @ApiProperty({ description: 'Chuỗi ngày học hiện tại' })
  @IsInt()
  @Min(0)
  currentStreak: number;

  @ApiProperty({ description: 'Chuỗi ngày học dài nhất' })
  @IsInt()
  @Min(0)
  longestStreak: number;

  @ApiProperty({ description: 'Tổng số lần ôn tập' })
  @IsInt()
  @Min(0)
  totalReviews: number;

  @ApiPropertyOptional({ description: 'Lần học gần nhất' })
  lastStudiedAt?: Date;
}

export class ReviewResultDto {
  @ApiProperty({ description: 'Số từ trả lời đúng' })
  correct: number;

  @ApiProperty({ description: 'Số từ trả lời sai' })
  wrong: number;

  @ApiProperty({ description: 'Ngày ôn tập tiếp theo' })
  nextReviewDate: Date;

  @ApiProperty({ description: 'Danh sách từ cần luyện thêm', type: [String] })
  needPractice: string[];

  @ApiProperty({ description: 'Danh sách từ đã thành thạo', type: [String] })
  mastered: string[];
}

// Response DTOs (using actual types from vocabulary-term.dto.ts)
export class ReviewSessionResponseDto {
  @ApiProperty({ description: 'Danh sách từ cần review', type: 'array' })
  terms: any[]; // VocabularyTermResponseDto[]

  @ApiProperty({ description: 'Tổng số từ cần ôn' })
  @IsInt()
  @Min(0)
  totalDue: number;

  @ApiPropertyOptional({ description: 'Số từ thực tế trả về trong session' })
  @IsOptional()
  @IsInt()
  @Min(0)
  returnedCount?: number;

  @ApiProperty({ description: 'Số từ mới' })
  @IsInt()
  @Min(0)
  newCount: number;

  @ApiProperty({ description: 'Số từ đang review' })
  @IsInt()
  @Min(0)
  reviewCount: number;

  @ApiProperty({ description: 'Chế độ review', enum: ReviewMode })
  mode: ReviewMode;
}

export class SubmitReviewResponseDto {
  @ApiProperty({ description: 'Số từ trả lời đúng' })
  correct: number;

  @ApiProperty({ description: 'Số từ trả lời sai' })
  wrong: number;

  @ApiProperty({ description: 'Ngày ôn tập tiếp theo' })
  nextReviewDate: Date;

  @ApiProperty({ description: 'Danh sách từ cần luyện thêm', type: [String] })
  needPractice: string[];

  @ApiProperty({ description: 'Danh sách từ đã thành thạo', type: [String] })
  mastered: string[];
}

export class GetDueCardsQueryDto {
  @ApiPropertyOptional({ description: 'ID của vocabulary list' })
  @IsOptional()
  @IsString()
  listId?: string;

  @ApiPropertyOptional({ description: 'Số lượng tối đa', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

export class ResetProgressDto {
  @ApiProperty({ description: 'ID của vocabulary unit' })
  @IsString()
  unitId: string;
}
