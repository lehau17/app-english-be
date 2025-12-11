import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GradeSubmissionDto {
  @ApiProperty({
    description: 'Điểm số cho bài nộp (số nguyên)',
    example: 85,
    minimum: 0,
    maximum: 100,
  })
  @IsInt({ message: 'Điểm phải là số nguyên' })
  @Min(0, { message: 'Điểm tối thiểu là 0' })
  @Max(100, { message: 'Điểm tối đa là 100' })
  grade: number;

  @ApiProperty({
    description: 'Nhận xét của giáo viên về bài làm',
    example: 'Bài làm tốt, cần cải thiện phần ngữ pháp.',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Nhận xét phải là chuỗi ký tự' })
  feedback?: string;
}

export class GradeSubmissionDetailedDto {
  @ApiProperty({
    description: 'Điểm số cho từng activity (activityId -> score)',
    example: { 'activity-1': 8, 'activity-2': 15, 'activity-3': 10 },
  })
  @IsObject({ message: 'activityScores phải là object' })
  activityScores: Record<string, number>;

  @ApiPropertyOptional({
    description: 'Nhận xét tổng thể của giáo viên',
    example: 'Bài làm tốt, cần cải thiện phần ngữ pháp.',
  })
  @IsOptional()
  @IsString({ message: 'Nhận xét phải là chuỗi ký tự' })
  feedback?: string;

  @ApiPropertyOptional({
    description:
      'Chấp nhận tất cả điểm AI (nếu true, sẽ dùng AI scores cho các activity chưa có teacher score)',
    default: false,
  })
  @IsOptional()
  acceptAIScores?: boolean;
}
