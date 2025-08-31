import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// DTO cho endpoint /query
export class QueryDto {
  @ApiProperty({
    description: 'Câu hỏi người dùng gửi cho AI Agent',
    example: 'Top 5 học sinh có GPA cao nhất lớp 12A1',
  })
  @IsString()
  @IsNotEmpty()
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
  title!: string;

  @ApiProperty({
    description: 'Nội dung tài liệu (plain text)',
    example:
      'Điều 15: Sinh viên được xét tốt nghiệp khi hoàn thành đủ tín chỉ và GPA >= 5.0...',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({
    description: 'Loại tài liệu',
    example: 'regulation',
    enum: ['regulation', 'handbook', 'curriculum'],
  })
  @IsString()
  documentType!: string;

  @ApiProperty({
    description: 'Nguồn tài liệu',
    example: 'Thông tư 08/2021/TT-BGDĐT',
  })
  @IsString()
  source!: string;
}
