import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsNumber,
    IsOptional,
    Min
} from 'class-validator';

export class SubmitAttemptDto {
  @ApiProperty({ description: 'User answers (JSON format)' })
  answers: any;

  @ApiPropertyOptional({ description: 'Time taken in seconds', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeTaken?: number;

  @ApiPropertyOptional({ description: 'Additional data (JSON format)' })
  @IsOptional()
  additionalData?: any;
}

export class GetAttemptsQueryDto extends RequestPagingDto {
  // Inherits: page, limit, search, sortBy, sortOrder from RequestPagingDto
  // sortBy can be used for 'newest', 'oldest', 'score' sorting
}
