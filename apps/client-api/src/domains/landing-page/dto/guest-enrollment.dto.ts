import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    ValidateIf,
    ValidateNested,
} from 'class-validator';

export enum GuestEnrollmentRole {
  student = 'student',
  parent = 'parent',
}

export class GuestPersonDto {
  @ApiProperty({
    description: 'Họ của người dùng',
    example: 'Nguyễn',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  firstName?: string;

  @ApiProperty({
    description: 'Tên của người dùng',
    example: 'An',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  lastName?: string;

  @ApiProperty({
    description: 'Tên hiển thị',
    example: 'Nguyễn An',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  displayName?: string;

  @ApiProperty({
    description: 'Địa chỉ email',
    example: 'student@example.com',
  })
  @IsString()
  @Length(3, 150)
  email: string;

  @ApiProperty({
    description: 'Số điện thoại liên hệ',
    example: '+84881234567',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(6, 30)
  phone?: string;

  @ApiProperty({
    description: 'Ghi chú thêm',
    example: 'Quan tâm lớp buổi tối',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  note?: string;
}

export class GuestEnrollmentDto {
  @ApiProperty({
    enum: GuestEnrollmentRole,
    description: 'Đăng ký với tư cách học viên hay phụ huynh',
  })
  @IsEnum(GuestEnrollmentRole)
  role: GuestEnrollmentRole;

  @ApiProperty({
    description: 'Khóa học khách đăng ký',
  })
  @IsUUID()
  courseId: string;

  @ApiProperty({
    description: 'Lớp học cụ thể',
  })
  @IsUUID()
  classroomId: string;

  @ApiProperty({
    description: 'Thông tin học viên sẽ tham gia lớp (có thể nhiều học sinh nếu role=parent)',
    type: () => [GuestPersonDto],
  })
  @ValidateNested({ each: true })
  @Type(() => GuestPersonDto)
  @IsArray()
  students: GuestPersonDto[];

  @ApiProperty({
    description: 'Thông tin phụ huynh (bắt buộc nếu role=parent)',
    required: false,
    type: () => GuestPersonDto,
  })
  @ValidateIf((o: GuestEnrollmentDto) => o.role === GuestEnrollmentRole.parent)
  @ValidateNested()
  @Type(() => GuestPersonDto)
  parent?: GuestPersonDto;

  @ApiProperty({
    description: 'URL redirect sau khi thanh toán',
    example: 'https://landing.example.com/payment/return',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(3, 255)
  returnUrl?: string;

  @ApiProperty({
    description: 'Nguồn lead',
    example: 'landing-page',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  source?: string;

  @ApiProperty({
    description: 'Các nhu cầu hỗ trợ cụ thể',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportNeeds?: string[];

  @ApiProperty({
    description: 'Khách đồng ý nhận tư vấn qua điện thoại/email',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  consentToContact?: boolean;

  @ApiProperty({
    description: 'Ghi chú bổ sung cho đội tư vấn',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;
}
