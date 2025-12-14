import { DifficultyLevel } from '@prisma/client';
import {
  calculateNormalizedScore,
  getDifficultyMultiplier,
  getNextDifficulty,
  shouldAdjustDifficulty,
} from './difficulty-scoring.util';

describe('DifficultyScoring', () => {
  describe('calculateNormalizedScore', () => {
    it('should apply 1.0 multiplier for beginner', () => {
      const result = calculateNormalizedScore(80, DifficultyLevel.beginner);
      expect(result.rawScore).toBe(80);
      expect(result.normalizedScore).toBe(80);
      expect(result.multiplier).toBe(1.0);
    });

    it('should apply 1.05 multiplier for elementary', () => {
      const result = calculateNormalizedScore(80, DifficultyLevel.elementary);
      expect(result.rawScore).toBe(80);
      expect(result.normalizedScore).toBe(84); // 80 * 1.05 = 84
      expect(result.multiplier).toBe(1.05);
    });

    it('should apply 1.1 multiplier for intermediate', () => {
      const result = calculateNormalizedScore(80, DifficultyLevel.intermediate);
      expect(result.rawScore).toBe(80);
      expect(result.normalizedScore).toBe(88); // 80 * 1.1 = 88
      expect(result.multiplier).toBe(1.1);
    });

    it('should apply 1.15 multiplier for upper_intermediate', () => {
      const result = calculateNormalizedScore(
        80,
        DifficultyLevel.upper_intermediate,
      );
      expect(result.rawScore).toBe(80);
      expect(result.normalizedScore).toBe(92); // 80 * 1.15 = 92
      expect(result.multiplier).toBe(1.15);
    });

    it('should apply 1.2 multiplier for advanced', () => {
      const result = calculateNormalizedScore(80, DifficultyLevel.advanced);
      expect(result.rawScore).toBe(80);
      expect(result.normalizedScore).toBe(96); // 80 * 1.2 = 96
      expect(result.multiplier).toBe(1.2);
    });

    it('should apply 1.25 multiplier for expert', () => {
      const result = calculateNormalizedScore(80, DifficultyLevel.expert);
      expect(result.rawScore).toBe(80);
      expect(result.normalizedScore).toBe(100); // 80 * 1.25 = 100 (capped)
      expect(result.multiplier).toBe(1.25);
    });

    it('should cap normalized score at 100', () => {
      const result = calculateNormalizedScore(90, DifficultyLevel.advanced);
      expect(result.normalizedScore).toBe(100); // 90 * 1.2 = 108 → 100
    });

    it('should cap expert score at 100', () => {
      const result = calculateNormalizedScore(85, DifficultyLevel.expert);
      expect(result.normalizedScore).toBe(100); // 85 * 1.25 = 106.25 → 100
    });

    it('should round normalized score', () => {
      const result = calculateNormalizedScore(77, DifficultyLevel.elementary);
      expect(result.normalizedScore).toBe(81); // 77 * 1.05 = 80.85 → 81
    });

    it('should handle zero score', () => {
      const result = calculateNormalizedScore(0, DifficultyLevel.advanced);
      expect(result.normalizedScore).toBe(0);
    });
  });

  describe('shouldAdjustDifficulty', () => {
    describe('beginner thresholds (80/50)', () => {
      it('should return up when score >= 80', () => {
        expect(shouldAdjustDifficulty(80, DifficultyLevel.beginner)).toBe('up');
        expect(shouldAdjustDifficulty(85, DifficultyLevel.beginner)).toBe('up');
      });

      it('should return down when score <= 50', () => {
        expect(shouldAdjustDifficulty(50, DifficultyLevel.beginner)).toBe(
          'down',
        );
        expect(shouldAdjustDifficulty(45, DifficultyLevel.beginner)).toBe(
          'down',
        );
      });

      it('should return none when score in range', () => {
        expect(shouldAdjustDifficulty(70, DifficultyLevel.beginner)).toBe(
          'none',
        );
        expect(shouldAdjustDifficulty(51, DifficultyLevel.beginner)).toBe(
          'none',
        );
        expect(shouldAdjustDifficulty(79, DifficultyLevel.beginner)).toBe(
          'none',
        );
      });
    });

    describe('intermediate thresholds (85/45)', () => {
      it('should return up when score >= 85', () => {
        expect(shouldAdjustDifficulty(85, DifficultyLevel.intermediate)).toBe(
          'up',
        );
        expect(shouldAdjustDifficulty(90, DifficultyLevel.intermediate)).toBe(
          'up',
        );
      });

      it('should return down when score <= 45', () => {
        expect(shouldAdjustDifficulty(45, DifficultyLevel.intermediate)).toBe(
          'down',
        );
        expect(shouldAdjustDifficulty(40, DifficultyLevel.intermediate)).toBe(
          'down',
        );
      });

      it('should return none when score in range', () => {
        expect(shouldAdjustDifficulty(70, DifficultyLevel.intermediate)).toBe(
          'none',
        );
      });
    });

    describe('advanced thresholds (90/40)', () => {
      it('should return up when score >= 90', () => {
        expect(shouldAdjustDifficulty(90, DifficultyLevel.advanced)).toBe('up');
        expect(shouldAdjustDifficulty(95, DifficultyLevel.advanced)).toBe('up');
      });

      it('should return down when score <= 40', () => {
        expect(shouldAdjustDifficulty(40, DifficultyLevel.advanced)).toBe(
          'down',
        );
        expect(shouldAdjustDifficulty(35, DifficultyLevel.advanced)).toBe(
          'down',
        );
      });

      it('should return none when score in range', () => {
        expect(shouldAdjustDifficulty(70, DifficultyLevel.advanced)).toBe(
          'none',
        );
      });
    });

    describe('expert thresholds (92/38)', () => {
      it('should return up when score >= 92', () => {
        expect(shouldAdjustDifficulty(92, DifficultyLevel.expert)).toBe('up');
        expect(shouldAdjustDifficulty(95, DifficultyLevel.expert)).toBe('up');
      });

      it('should return down when score <= 38', () => {
        expect(shouldAdjustDifficulty(38, DifficultyLevel.expert)).toBe('down');
        expect(shouldAdjustDifficulty(30, DifficultyLevel.expert)).toBe('down');
      });

      it('should return none when score in range', () => {
        expect(shouldAdjustDifficulty(70, DifficultyLevel.expert)).toBe('none');
      });
    });
  });

  describe('getNextDifficulty', () => {
    it('should increase difficulty by one level', () => {
      expect(getNextDifficulty(DifficultyLevel.beginner, 'up')).toBe(
        DifficultyLevel.elementary,
      );
      expect(getNextDifficulty(DifficultyLevel.elementary, 'up')).toBe(
        DifficultyLevel.intermediate,
      );
      expect(getNextDifficulty(DifficultyLevel.intermediate, 'up')).toBe(
        DifficultyLevel.upper_intermediate,
      );
      expect(getNextDifficulty(DifficultyLevel.upper_intermediate, 'up')).toBe(
        DifficultyLevel.advanced,
      );
      expect(getNextDifficulty(DifficultyLevel.advanced, 'up')).toBe(
        DifficultyLevel.expert,
      );
    });

    it('should decrease difficulty by one level', () => {
      expect(getNextDifficulty(DifficultyLevel.expert, 'down')).toBe(
        DifficultyLevel.advanced,
      );
      expect(getNextDifficulty(DifficultyLevel.advanced, 'down')).toBe(
        DifficultyLevel.upper_intermediate,
      );
      expect(
        getNextDifficulty(DifficultyLevel.upper_intermediate, 'down'),
      ).toBe(DifficultyLevel.intermediate);
      expect(getNextDifficulty(DifficultyLevel.intermediate, 'down')).toBe(
        DifficultyLevel.elementary,
      );
      expect(getNextDifficulty(DifficultyLevel.elementary, 'down')).toBe(
        DifficultyLevel.beginner,
      );
    });

    it('should not increase beyond expert', () => {
      expect(getNextDifficulty(DifficultyLevel.expert, 'up')).toBe(
        DifficultyLevel.expert,
      );
    });

    it('should not decrease below beginner', () => {
      expect(getNextDifficulty(DifficultyLevel.beginner, 'down')).toBe(
        DifficultyLevel.beginner,
      );
    });
  });

  describe('getDifficultyMultiplier', () => {
    it('should return correct multiplier for each difficulty', () => {
      expect(getDifficultyMultiplier(DifficultyLevel.beginner)).toBe(1.0);
      expect(getDifficultyMultiplier(DifficultyLevel.elementary)).toBe(1.05);
      expect(getDifficultyMultiplier(DifficultyLevel.intermediate)).toBe(1.1);
      expect(getDifficultyMultiplier(DifficultyLevel.upper_intermediate)).toBe(
        1.15,
      );
      expect(getDifficultyMultiplier(DifficultyLevel.advanced)).toBe(1.2);
      expect(getDifficultyMultiplier(DifficultyLevel.expert)).toBe(1.25);
    });
  });
});
