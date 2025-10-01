import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePodcastCommentDto {
  @ApiProperty({
    description: 'ID của podcast',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  podcastId: string;

  @ApiProperty({
    description: 'Nội dung bình luận',
    example: 'Bài podcast này rất hay và bổ ích!',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  @ApiPropertyOptional({
    description: 'ID của comment cha (nếu là reply)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdatePodcastCommentDto {
  @ApiProperty({
    description: 'Nội dung bình luận mới',
    example: 'Bài podcast này thật sự rất tuyệt vời!',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}

export class PodcastCommentResponseDto {
  @ApiProperty({
    description: 'ID của comment',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'ID của user tạo comment',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  userId: string;

  @ApiProperty({
    description: 'ID của podcast',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  podcastId: string;

  @ApiPropertyOptional({
    description: 'ID của comment cha',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  parentId?: string;

  @ApiProperty({
    description: 'Nội dung comment',
    example: 'Bài podcast này rất hay!',
  })
  content: string;

  @ApiProperty({
    description: 'Comment đã được chỉnh sửa',
    example: false,
  })
  isEdited: boolean;

  @ApiProperty({
    description: 'Comment bị báo cáo',
    example: false,
  })
  isReported: boolean;

  @ApiProperty({
    description: 'Comment đã được kiểm duyệt',
    example: false,
  })
  isModerated: boolean;

  @ApiProperty({
    description: 'Số lượt like',
    example: 5,
  })
  likeCount: number;

  @ApiProperty({
    description: 'Số lượng reply',
    example: 2,
  })
  replyCount: number;

  @ApiProperty({
    description: 'Thời gian tạo',
    example: '2025-09-16T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Thời gian cập nhật',
    example: '2025-09-16T10:35:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Thông tin user tạo comment',
  })
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
  };

  @ApiPropertyOptional({
    description: 'Comment replies (nếu có)',
  })
  replies?: PodcastCommentResponseDto[];
}

export class ReportCommentDto {
  @ApiProperty({
    description: 'Lý do báo cáo',
    example: 'Nội dung không phù hợp',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class LikeCommentDto {
  @ApiProperty({
    description: 'Trạng thái like',
    example: true,
  })
  @IsBoolean()
  isLiked: boolean;
}
