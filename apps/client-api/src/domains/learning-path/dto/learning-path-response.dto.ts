import { ApiProperty } from '@nestjs/swagger';
import { DifficultyLevel } from '@prisma/client';

export class LearningPathResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: DifficultyLevel })
  targetLevel!: DifficultyLevel;

  @ApiProperty({ type: [String] })
  focusAreas!: string[];

  @ApiProperty({ required: false })
  timeframe?: number;

  @ApiProperty({ type: [String] })
  courseIds!: string[];

  @ApiProperty({ required: false })
  customContent?: Record<string, any>;

  @ApiProperty()
  currentStep!: number;

  @ApiProperty()
  isCompleted!: boolean;

  @ApiProperty({ required: false })
  completedAt?: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ required: false })
  progress?: {
    totalSteps: number;
    completedSteps: number;
    percentage: number;
  };
}



