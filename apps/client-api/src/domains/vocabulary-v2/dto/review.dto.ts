import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
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
}

export class ReviewStatsDto {
  @ApiProperty({ description: 'Tổng số từ' })
  totalTerms: number;

  @ApiProperty({ description: 'Số từ mới' })
  newCount: number;

  @ApiProperty({ description: 'Số từ đang học' })
  learningCount: number;

  @ApiProperty({ description: 'Số từ đang ôn tập' })
  reviewCount: number;

  @ApiProperty({ description: 'Số từ đã thành thạo' })
  masteredCount: number;

  @ApiProperty({ description: 'Số từ cần ôn hôm nay' })
  dueToday: number;

  @ApiProperty({ description: 'Chuỗi ngày học hiện tại' })
  currentStreak: number;

  @ApiProperty({ description: 'Chuỗi ngày học dài nhất' })
  longestStreak: number;

  @ApiProperty({ description: 'Tổng số lần ôn tập' })
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
  totalDue: number;

  @ApiProperty({ description: 'Số từ mới' })
  newCount: number;

  @ApiProperty({ description: 'Số từ đang review' })
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
