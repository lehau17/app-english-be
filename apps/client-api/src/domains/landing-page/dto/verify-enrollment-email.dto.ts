import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { GuestEnrollmentRole } from './guest-enrollment.dto';

class StudentInfoDto {
  @ApiProperty({ example: 'Nguyen' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Van A' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'student@example.com' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

class ParentInfoDto {
  @ApiProperty({ example: 'Nguyen' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Van B' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'parent@example.com' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '0907654321' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class VerifyEnrollmentEmailDto {
  @ApiProperty({
    enum: GuestEnrollmentRole,
    example: GuestEnrollmentRole.student,
    description: 'Vai trò đăng ký: student hoặc parent',
  })
  @IsEnum(GuestEnrollmentRole)
  role: GuestEnrollmentRole;

  @ApiProperty({
    type: [StudentInfoDto],
    description: 'Danh sách học sinh đăng ký',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentInfoDto)
  students: StudentInfoDto[];

  @ApiProperty({
    type: ParentInfoDto,
    required: false,
    description: 'Thông tin phụ huynh (bắt buộc nếu role = parent)',
  })
  @ValidateIf((o) => o.role === GuestEnrollmentRole.parent)
  @IsObject()
  @ValidateNested()
  @Type(() => ParentInfoDto)
  parent?: ParentInfoDto;

  @ApiProperty({ example: 'course-uuid' })
  @IsUUID()
  courseId: string;

  @ApiProperty({ example: 'classroom-uuid' })
  @IsUUID()
  classroomId: string;

  @ApiProperty({ required: false, example: 'Ghi chú đặc biệt' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ required: false, example: 'facebook' })
  @IsOptional()
  @IsString()
  source?: string;
}
