import { DifficultyLevel, StepStatus } from '@prisma/client';

/**
 * Response DTO for learning path step
 */
export class StepResponseDto {
  id: string;
  learningPathId: string;
  activityId?: string;
  variantId?: string;
  orderNo: number;
  status: StepStatus;
  difficulty: DifficultyLevel;

  title?: string;
  description?: string;

  // Performance tracking
  score?: number;
  completedAt?: Date;
  timeSpent?: number;
  attemptCount: number;
  lastAttemptedAt?: Date;

  // Adaptivity data
  wasSkipped: boolean;
  skipReason?: string;
  recommendedNext: string[];
  adaptivityReason?: string;

  createdAt: Date;
  updatedAt: Date;
}
