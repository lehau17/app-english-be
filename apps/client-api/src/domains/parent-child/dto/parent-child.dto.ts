import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateParentChildDto {
  @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
  @IsUUID()
  parentId: string;

  @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
  @IsUUID()
  childId: string;
}

export class FilterParentChildRequestDto extends RequestPagingDto {
  @ApiPropertyOptional({
    description: 'Filter by parentId',
    example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
  })
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Filter by childId',
    example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b',
  })
  @IsUUID()
  childId?: string;
}
