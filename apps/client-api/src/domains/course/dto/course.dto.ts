import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DifficultyLevel, LanguageCode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import { CreateLessonDto } from '../../lesson/dto/lesson.dto';
export const ACTIVITY_TYPES = [
  'vocab','pronunciation','listening','speaking','mini_game',
  'fill_blank','dictation','matching',
  'reading','writing','grammar','quiz','flashcard','conversation'
] as const;
export type ActivityTypeValue = typeof ACTIVITY_TYPES[number];

export class CreateCourseDto {
  @ApiProperty({ example: 'Introduction to English Grammar' })
  @IsString() @MinLength(3) @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({ example: 'A comprehensive course on the basics of English grammar.' })
  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 1 }) // tuỳ chọn business rule duy nhất
  @IsOptional() @Type(() => Number) @IsInt()
  orderNo?: number;

  @ApiProperty({ enum: DifficultyLevel, example: DifficultyLevel.beginner })
  @IsEnum(DifficultyLevel)
  difficulty!: DifficultyLevel;

  @ApiPropertyOptional({ example: 600, description: 'Tổng thời lượng ước tính (phút)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  estimatedTime?: number;               // MINUTES (server sẽ convert sang hours)

  @ApiPropertyOptional({ example: 'https://cdn.ex/img.png' })
  @IsOptional() @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ type: [String], example: ['grammar', 'beginner'] })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ArrayUnique() @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    example: 'c3a3a6d2-b4e8-4b1b-8b0d-1e9c3e1e5e77',
    description: 'Instructor (teacher) id',
  })
  @IsUUID()
  instructorId!: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'VND', description: 'ISO currency code (VD: VND, USD)' })
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  maxStudents?: number;

  @ApiPropertyOptional({ enum: LanguageCode, example: LanguageCode.vi })
  @IsOptional() @IsEnum(LanguageCode)
  language?: LanguageCode;

  @ApiPropertyOptional({ type: [String], example: ['uuid-course-1', 'uuid-course-2'] })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ArrayUnique() @IsString({ each: true })
  prerequisites?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional() @IsBoolean()
  isPublished?: boolean;

  // server sẽ tính lại nên để optional, bỏ qua nếu client gửi
  @ApiPropertyOptional({ example: 12 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  totalLessons?: number;

  @ApiPropertyOptional({ example: 480, description: 'Tổng thời lượng (phút)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  totalDuration?: number;

  @ApiProperty({ type: () => [CreateLessonDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @Type(() => CreateLessonDto)
  lessons!: CreateLessonDto[];
}
export class UpdateCourseDto {
  @ApiPropertyOptional({ example: 'Advanced English Grammar' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title?: string;

  @ApiPropertyOptional({
    example: 'An in-depth look at advanced grammar topics.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderNo?: number;

  @ApiPropertyOptional({ enum: DifficultyLevel })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ example: 900 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedTime?: number;

  @ApiPropertyOptional({ example: 'https://cdn.ex/cover.png' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'VND' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ example: 2000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @ApiPropertyOptional({ enum: LanguageCode })
  @IsOptional()
  @IsEnum(LanguageCode)
  language?: LanguageCode;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  prerequisites?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalLessons?: number;

  @ApiPropertyOptional({ example: 720 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalDuration?: number;
}

export class FilterCourseRequestDto extends RequestPagingDto {
  @ApiPropertyOptional({
    description: 'Search by title/description',
    example: 'Grammar',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: DifficultyLevel })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 2000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: LanguageCode })
  @IsOptional()
  @IsEnum(LanguageCode)
  language?: LanguageCode;

  @ApiPropertyOptional({
    description: 'Filter by instructor',
    example: 'uuid-teacher',
  })
  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @ApiPropertyOptional({ description: 'Tag filter', example: 'grammar' })
  @IsOptional()
  @IsString()
  tag?: string;

  // sortBy/sortOrder dùng từ RequestPagingDto,
  // nhưng service sẽ WHITELIST trường hợp an toàn.
}




export class ImportCoursesDto {
  @ApiProperty({ example: 'https://cdn.example.com/courses.xlsx' })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ example: true, description: 'Chỉ parse & trả preview, không ghi DB' })
  @IsOptional() @IsBoolean() dryRun?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Nếu Title trùng thì update (upsert theo title)' })
  @IsOptional() @IsBoolean() upsert?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Publish ngay sau khi import' })
  @IsOptional() @IsBoolean() publish?: boolean;

  @ApiPropertyOptional({
    example: '639fc4bd-1219-484f-9985-4912180f0809',
    description: 'Instructor mặc định nếu không điền trong sheet Courses',
  })
  @IsOptional() @IsUUID() defaultInstructorId?: string;

  @ApiPropertyOptional({
    example: 'title',
    description: 'Cách xác định course để upsert: "title" (mặc định) hoặc "orderNo"',
  })
  @IsOptional() @IsString() matchBy?: 'title' | 'orderNo';
}
