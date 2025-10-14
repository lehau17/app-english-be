import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class TransactionFilterDto {
  @ApiPropertyOptional({
    description: 'Số trang',
    default: 1,
    type: Number,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng mục mỗi trang',
    default: 10,
    type: Number,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Lọc theo trạng thái giao dịch',
  })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Lọc theo email của học sinh',
  })
  @IsString()
  @IsOptional()
  studentEmail?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo ID khóa học',
  })
  @IsString()
  @IsOptional()
  courseId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo ID lớp học',
  })
  @IsString()
  @IsOptional()
  classroomId?: string;

  @ApiPropertyOptional({
    description: 'Lọc từ ngày (ISO 8601)',
    type: Date,
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Lọc đến ngày (ISO 8601)',
    type: Date,
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Sắp xếp theo (createdAt hoặc amount)',
    enum: ['createdAt', 'amount'],
  })
  @IsString()
  @IsOptional()
  sortBy?: 'createdAt' | 'amount' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Thứ tự sắp xếp (asc hoặc desc)',
    enum: ['asc', 'desc'],
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}