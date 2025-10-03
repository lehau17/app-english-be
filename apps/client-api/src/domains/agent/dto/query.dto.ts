import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, IsIn } from 'class-validator';

// DTO cho endpoint /query
export class QueryDto {
  @ApiProperty({
    description: 'Câu hỏi người dùng gửi cho AI Agent',
    example: 'Top 5 học sinh có GPA cao nhất lớp 12A1',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000, { message: 'Câu hỏi không được vượt quá 1000 ký tự' })
  question!: string;
}

// DTO cho endpoint /documents (thêm tài liệu vào knowledge base)
export class AddDocumentDto {
  @ApiProperty({
    description: 'Tiêu đề tài liệu',
    example: 'Quy chế đào tạo - Điều kiện tốt nghiệp',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500, { message: 'Tiêu đề không được vượt quá 500 ký tự' })
  title!: string;

  @ApiProperty({
    description: 'Nội dung tài liệu (plain text)',
    example:
      'Điều 15: Sinh viên được xét tốt nghiệp khi hoàn thành đủ tín chỉ và GPA >= 5.0...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000, { message: 'Nội dung không được vượt quá 50000 ký tự' })
  content!: string;

  @ApiProperty({
    description: 'Loại tài liệu',
    example: 'regulation',
    enum: ['regulation', 'handbook', 'curriculum', 'faq', 'policy'],
  })
  @IsString()
  @IsIn(['regulation', 'handbook', 'curriculum', 'faq', 'policy'], {
    message: 'Loại tài liệu không hợp lệ',
  })
  documentType!: string;

  @ApiProperty({
    description: 'Nguồn tài liệu',
    example: 'Thông tư 08/2021/TT-BGDĐT',
  })
  @IsString()
  @MaxLength(200, { message: 'Nguồn không được vượt quá 200 ký tự' })
  source!: string;
}
