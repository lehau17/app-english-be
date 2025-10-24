import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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

