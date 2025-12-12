import { ApiProperty } from '@nestjs/swagger';

export class RecommendationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  confidence!: number;

  @ApiProperty({ required: false })
  reasoning?: string;

  @ApiProperty({ required: false })
  targetData?: Record<string, any>;

  @ApiProperty()
  viewed!: boolean;

  @ApiProperty()
  clicked!: boolean;

  @ApiProperty()
  dismissed!: boolean;

  @ApiProperty({ required: false })
  expiresAt?: Date;

  @ApiProperty()
  createdAt!: Date;
}



