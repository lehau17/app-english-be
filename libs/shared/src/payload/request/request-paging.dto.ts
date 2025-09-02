// dto
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RequestPagingDto {
  @ApiPropertyOptional({ type: Number, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value) : value,
  )
  page: number = 1;

  @ApiPropertyOptional({ type: Number, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value) : value,
  )
  limit: number = 10;

  @ApiPropertyOptional({ type: String, example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({ type: String, example: 'john' })
  @IsOptional()
  @IsString()
  search?: string;
}
export class FilterStudentRequestDto extends RequestPagingDto {}
