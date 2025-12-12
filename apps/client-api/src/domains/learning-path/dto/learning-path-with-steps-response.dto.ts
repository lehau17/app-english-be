import { DifficultyLevel } from '@prisma/client';
import { StepResponseDto } from './step-response.dto';

/**
 * Response DTO for learning path with steps included
 */
export class LearningPathWithStepsResponseDto {
  id: string;
  userId: string;
  classroomId?: string;
  name: string;

  // Path configuration
  targetLevel: DifficultyLevel;
  focusAreas: string[];
  timeframe?: number;

  // Content
  activityIds: string[]; // Legacy field
  customContent?: any;

  // Dynamic path features
  isDynamic: boolean;

  // Progress
  currentStep: number;
  isCompleted: boolean;
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;

  // NEW: Include steps
  steps?: StepResponseDto[];

  // Progress calculation
  totalSteps?: number;
  progressPercentage?: number;
}
