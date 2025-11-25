import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUrl, IsUUID } from 'class-validator';

export class EnrollClassroomDto {
  @ApiProperty({
    example: 'classroom-uuid',
    description: 'ID của lớp học muốn đăng ký',
  })
  @IsUUID()
  classroomId: string;

  @ApiProperty({
    example: 'course-uuid',
    description: 'ID của khóa học',
  })
  @IsUUID()
  courseId: string;

  @ApiProperty({
    required: false,
    example: 'https://app.example.com/payment/return',
    description: 'URL callback sau khi thanh toán',
  })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;
}
