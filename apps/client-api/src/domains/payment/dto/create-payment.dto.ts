import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'ID của khóa học cần thanh toán',
    example: 'course-uuid',
  })
  @IsUUID()
  courseId: string;

  @ApiProperty({
    description: 'ID của lớp học (classroom)',
    example: 'classroom-uuid',
  })
  @IsUUID()
  classroomId: string;

  @ApiProperty({
    description: 'Số tiền thanh toán',
    example: 500000,
    minimum: 1000,
  })
  @IsNumber()
  @Min(1000, { message: 'Số tiền tối thiểu là 1,000 VND' })
  amount: number;

  @ApiProperty({
    description: 'Mã tiền tệ',
    example: 'VND',
    required: false,
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Mô tả thanh toán',
    example: 'Thanh toán khóa học tiếng Anh cơ bản',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'URL trở về sau khi thanh toán',
    example: 'http://localhost:5173/payment/return',
    required: false,
  })
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @ApiProperty({
    description: 'ID của học sinh (để phụ huynh thanh toán cho con)',
    example: 'student-uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  studentId?: string;
}
