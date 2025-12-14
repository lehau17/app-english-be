import { DifficultyLevel } from '@prisma/client';

/**
 * Difficulty multipliers for score normalization.
 * Higher difficulty levels get higher multipliers to reward harder tasks.
 */
const DIFFICULTY_MULTIPLIERS: Record<DifficultyLevel, number> = {
  [DifficultyLevel.beginner]: 1.0,
  [DifficultyLevel.elementary]: 1.05,
  [DifficultyLevel.intermediate]: 1.1,
  [DifficultyLevel.upper_intermediate]: 1.15,
  [DifficultyLevel.advanced]: 1.2,
  [DifficultyLevel.expert]: 1.25,
};

/**
 * Difficulty-specific thresholds for progression.
 * Higher difficulty levels require higher scores to progress.
 */
const DIFFICULTY_THRESHOLDS: Record<
  DifficultyLevel,
  { up: number; down: number }
> = {
  [DifficultyLevel.beginner]: { up: 80, down: 50 },
  [DifficultyLevel.elementary]: { up: 82, down: 48 },
  [DifficultyLevel.intermediate]: { up: 85, down: 45 },
  [DifficultyLevel.upper_intermediate]: { up: 87, down: 43 },
  [DifficultyLevel.advanced]: { up: 90, down: 40 },
  [DifficultyLevel.expert]: { up: 92, down: 38 },
};

/**
 * Result of score calculation with difficulty normalization
 */
export interface ScoringResult {
  rawScore: number;
  normalizedScore: number;
  multiplier: number;
}

/**
 * Calculate normalized score with difficulty multiplier.
 * Higher difficulty tasks get score boost to reflect increased challenge.
 *
 * @param rawScore - Original score from evaluation (0-100)
 * @param difficulty - Current difficulty level
 * @returns Scoring result with raw, normalized scores and multiplier
 */
export function calculateNormalizedScore(
  rawScore: number,
  difficulty: DifficultyLevel,
): ScoringResult {
  const multiplier = DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;
  const normalizedScore = Math.min(100, Math.round(rawScore * multiplier));

  return {
    rawScore,
    normalizedScore,
    multiplier,
  };
}

/**
 * Determine if difficulty should be adjusted based on normalized score.
 * Uses difficulty-specific thresholds for progression.
 *
 * @param normalizedScore - Score after difficulty adjustment
 * @param currentDifficulty - Current difficulty level
 * @returns Direction to adjust difficulty ('up', 'down', or 'none')
 */
export function shouldAdjustDifficulty(
  normalizedScore: number,
  currentDifficulty: DifficultyLevel,
): 'up' | 'down' | 'none' {
  const thresholds = DIFFICULTY_THRESHOLDS[currentDifficulty];

  if (normalizedScore >= thresholds.up) return 'up';
  if (normalizedScore <= thresholds.down) return 'down';
  return 'none';
}

/**
 * Get next difficulty level in specified direction.
 * Clamps at minimum (beginner) and maximum (expert).
 *
 * @param current - Current difficulty level
 * @param direction - Direction to move ('up' or 'down')
 * @returns Next difficulty level
 */
export function getNextDifficulty(
  current: DifficultyLevel,
  direction: 'up' | 'down',
): DifficultyLevel {
  const levels = Object.values(DifficultyLevel);
  const currentIndex = levels.indexOf(current);

  if (direction === 'up' && currentIndex < levels.length - 1) {
    return levels[currentIndex + 1];
  }
  if (direction === 'down' && currentIndex > 0) {
    return levels[currentIndex - 1];
  }
  return current;
}

/**
 * Export multipliers for external use (e.g., metrics storage)
 */
export const getDifficultyMultiplier = (
  difficulty: DifficultyLevel,
): number => {
  return DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;
};
