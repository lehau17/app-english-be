/**
 * Text Similarity Utilities - Unit Tests
 *
 * Comprehensive test suite for pronunciation validation algorithms.
 * Target: 85%+ coverage across all functions.
 */

import {
  calculateJaroWinkler,
  calculateCosine,
  calculateLevenshtein,
  detectMiscues,
  calculateCombinedSimilarity,
  validatePronunciation,
  ValidationDecision,
} from './text-similarity.util';

// ============================================================================
// Jaro-Winkler Tests
// ============================================================================

describe('calculateJaroWinkler', () => {
  it('should return 1.0 for identical strings', () => {
    expect(calculateJaroWinkler('hello', 'hello')).toBe(1.0);
  });

  it('should return >0.90 for minor typos', () => {
    expect(calculateJaroWinkler('hello', 'helo')).toBeGreaterThan(0.9);
  });

  it('should be case-insensitive', () => {
    expect(calculateJaroWinkler('Hello', 'HELLO')).toBe(1.0);
  });

  it('should return low score for completely different strings', () => {
    expect(calculateJaroWinkler('hello', 'xyz')).toBeLessThan(0.3);
  });

  it('should handle empty strings', () => {
    expect(calculateJaroWinkler('', '')).toBe(1.0);
    expect(calculateJaroWinkler('hello', '')).toBe(0.0);
  });

  it('should handle whitespace trimming', () => {
    expect(calculateJaroWinkler('  hello  ', 'hello')).toBe(1.0);
  });

  it('should return high score for similar words', () => {
    expect(calculateJaroWinkler('cat', 'cut')).toBeGreaterThan(0.7);
  });

  it('should handle single character strings', () => {
    expect(calculateJaroWinkler('a', 'a')).toBe(1.0);
    expect(calculateJaroWinkler('a', 'b')).toBeLessThan(1.0);
  });
});

// ============================================================================
// Cosine Similarity Tests
// ============================================================================

describe('calculateCosine', () => {
  it('should return 1.0 for identical phrases', () => {
    expect(calculateCosine('I love my mom', 'I love my mom')).toBe(1.0);
  });

  it('should return >0.75 for partial word overlap', () => {
    const score = calculateCosine('I love my mom and dad', 'I love my mom');
    expect(score).toBeGreaterThan(0.75);
  });

  it('should be order-insensitive', () => {
    const score = calculateCosine('hello world', 'world hello');
    expect(score).toBe(1.0);
  });

  it('should return low score for different content', () => {
    const score = calculateCosine('I love my mom', 'hello my name is Hạu');
    expect(score).toBeLessThan(0.4);
  });

  it('should handle empty phrases', () => {
    expect(calculateCosine('', '')).toBe(1.0);
    expect(calculateCosine('hello', '')).toBe(0.0);
    expect(calculateCosine('', 'world')).toBe(0.0);
  });

  it('should handle punctuation removal', () => {
    const score = calculateCosine('hello, world!', 'hello world');
    expect(score).toBe(1.0);
  });

  it('should handle multiple spaces', () => {
    expect(calculateCosine('hello   world', 'hello world')).toBe(1.0);
  });

  it('should calculate correct score for single word overlap', () => {
    const score = calculateCosine('apple banana', 'apple cherry');
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(0.8);
  });

  it('should handle case insensitivity', () => {
    expect(calculateCosine('Hello World', 'HELLO WORLD')).toBe(1.0);
  });
});

// ============================================================================
// Levenshtein Distance Tests
// ============================================================================

describe('calculateLevenshtein', () => {
  it('should return distance 0 for identical strings', () => {
    const result = calculateLevenshtein('hello', 'hello');
    expect(result.distance).toBe(0);
    expect(result.normalized).toBe(1.0);
  });

  it('should return distance 1 for single character difference', () => {
    const result = calculateLevenshtein('hello', 'hallo');
    expect(result.distance).toBe(1);
  });

  it('should normalize by max length', () => {
    const result = calculateLevenshtein('hello', 'helo');
    expect(result.normalized).toBeCloseTo(0.8, 1);
  });

  it('should handle completely different strings', () => {
    const result = calculateLevenshtein('abc', 'xyz');
    expect(result.distance).toBe(3);
    expect(result.normalized).toBe(0.0);
  });

  it('should handle empty strings', () => {
    const result1 = calculateLevenshtein('', '');
    expect(result1.distance).toBe(0);
    expect(result1.normalized).toBe(1.0);

    const result2 = calculateLevenshtein('hello', '');
    expect(result2.distance).toBe(5);
    expect(result2.normalized).toBe(0.0);
  });

  it('should be case-insensitive', () => {
    const result = calculateLevenshtein('Hello', 'hello');
    expect(result.distance).toBe(0);
  });

  it('should handle whitespace trimming', () => {
    const result = calculateLevenshtein('  hello  ', 'hello');
    expect(result.distance).toBe(0);
  });

  it('should calculate correct distance for insertions', () => {
    const result = calculateLevenshtein('cat', 'cart');
    expect(result.distance).toBe(1);
  });

  it('should calculate correct distance for deletions', () => {
    const result = calculateLevenshtein('cart', 'cat');
    expect(result.distance).toBe(1);
  });
});

// ============================================================================
// Miscue Detection Tests
// ============================================================================

describe('detectMiscues', () => {
  it('should detect missing words', () => {
    const result = detectMiscues('I love my mom and dad', 'I love my mom');
    expect(result.missingWords).toContain('and');
    expect(result.missingWords).toContain('dad');
  });

  it('should detect extra words', () => {
    const result = detectMiscues('hello world', 'hello beautiful world');
    expect(result.extraWords).toContain('beautiful');
  });

  it('should detect repeated words', () => {
    const result = detectMiscues('hello world', 'hello hello world');
    expect(result.repeatedWords).toContain('hello');
  });

  it('should identify matched words', () => {
    const result = detectMiscues('I love you', 'I love');
    expect(result.matchedWords).toContain('i');
    expect(result.matchedWords).toContain('love');
  });

  it('should handle identical phrases', () => {
    const result = detectMiscues('hello world', 'hello world');
    expect(result.extraWords).toHaveLength(0);
    expect(result.missingWords).toHaveLength(0);
    expect(result.matchedWords).toHaveLength(2);
  });

  it('should handle completely different phrases', () => {
    const result = detectMiscues('hello world', 'goodbye universe');
    expect(result.extraWords).toContain('goodbye');
    expect(result.extraWords).toContain('universe');
    expect(result.missingWords).toContain('hello');
    expect(result.missingWords).toContain('world');
    expect(result.matchedWords).toHaveLength(0);
  });

  it('should handle punctuation', () => {
    const result = detectMiscues('hello, world!', 'hello world');
    expect(result.missingWords).toHaveLength(0);
    expect(result.extraWords).toHaveLength(0);
  });

  it('should detect multiple repeated words', () => {
    const result = detectMiscues(
      'hello world',
      'hello hello world world world',
    );
    expect(result.repeatedWords).toContain('hello');
    expect(result.repeatedWords).toContain('world');
  });

  it('should handle empty strings', () => {
    const result1 = detectMiscues('', '');
    expect(result1.extraWords).toHaveLength(0);
    expect(result1.missingWords).toHaveLength(0);

    const result2 = detectMiscues('hello', '');
    expect(result2.missingWords).toContain('hello');
  });

  it('should be case-insensitive', () => {
    const result = detectMiscues('Hello World', 'hello world');
    expect(result.missingWords).toHaveLength(0);
    expect(result.extraWords).toHaveLength(0);
  });
});

// ============================================================================
// Combined Similarity Tests
// ============================================================================

describe('calculateCombinedSimilarity', () => {
  it('should calculate weighted average correctly', () => {
    const result = calculateCombinedSimilarity(
      'I love my mom',
      'I love my mom',
    );
    expect(result.combined).toBeCloseTo(1.0, 1);
    expect(result.jaroWinkler).toBe(1.0);
    expect(result.cosine).toBe(1.0);
    expect(result.levenshtein).toBe(1.0);
  });

  it('should apply custom weights', () => {
    const config = {
      jaroWeight: 0.5,
      cosineWeight: 0.3,
      levenshteinWeight: 0.2,
    };
    const result = calculateCombinedSimilarity(
      'hello world',
      'hello earth',
      config,
    );
    expect(result.combined).toBeGreaterThan(0.5);
  });

  it('should throw error if weights do not sum to 1.0', () => {
    const config = {
      jaroWeight: 0.5,
      cosineWeight: 0.3,
      levenshteinWeight: 0.3,
    };
    expect(() => {
      calculateCombinedSimilarity('hello', 'world', config);
    }).toThrow('Similarity weights must sum to 1.0');
  });

  it('should use default weights when not provided', () => {
    const result = calculateCombinedSimilarity('hello', 'hello');
    expect(result.combined).toBe(1.0);
  });

  it('should calculate score for partially matching phrases', () => {
    const result = calculateCombinedSimilarity(
      'I love my mom',
      'I love my dad',
    );
    expect(result.combined).toBeGreaterThan(0.7);
    expect(result.combined).toBeLessThan(1.0);
  });

  it('should return low score for different phrases', () => {
    const result = calculateCombinedSimilarity(
      'hello world',
      'goodbye universe',
    );
    expect(result.combined).toBeLessThan(0.5);
  });

  it('should handle empty strings', () => {
    const result = calculateCombinedSimilarity('', '');
    expect(result.combined).toBe(1.0);
  });

  it('should accept weights that sum to 1.0 within tolerance', () => {
    const config = {
      jaroWeight: 0.333333,
      cosineWeight: 0.333333,
      levenshteinWeight: 0.333334,
    };
    expect(() => {
      calculateCombinedSimilarity('hello', 'world', config);
    }).not.toThrow();
  });
});

// ============================================================================
// Validation Decision Tests
// ============================================================================

describe('validatePronunciation', () => {
  it('should ACCEPT for high similarity (≥0.80)', () => {
    const result = validatePronunciation(
      'I love my mom and dad',
      'I love my mom and dad',
    );
    expect(result.decision).toBe(ValidationDecision.ACCEPT);
    expect(result.penalty).toBe(1.0);
    expect(result.feedback).toContain('chính xác');
  });

  it('should ADJUST for medium similarity (0.60-0.79)', () => {
    const result = validatePronunciation(
      'I love my mom and dad',
      'I love my mom',
    );
    expect(result.decision).toBe(ValidationDecision.ADJUST_SCORE);
    expect(result.penalty).toBeGreaterThan(0.6);
    expect(result.penalty).toBeLessThan(1.0);
  });

  it('should REJECT for low similarity (<0.60)', () => {
    const result = validatePronunciation(
      'I love my mom and dad',
      'hello my name is Hạu',
    );
    expect(result.decision).toBe(ValidationDecision.REJECT);
    expect(result.penalty).toBe(0);
    expect(result.feedback).toContain('không khớp');
  });

  it('should respect custom thresholds', () => {
    const result = validatePronunciation('hello world', 'hello earth', {
      minThreshold: 0.5,
      goodThreshold: 0.7,
    });
    expect([
      ValidationDecision.ADJUST_SCORE,
      ValidationDecision.ACCEPT,
    ]).toContain(result.decision);
  });

  it('should provide Vietnamese feedback for rejection', () => {
    const result = validatePronunciation('I love my mom', 'hello world');
    expect(result.feedback).toMatch(/không khớp|bỏ sót|nói thêm/);
  });

  it('should include miscue information', () => {
    const result = validatePronunciation('I love my mom', 'I love my dad');
    expect(result.miscues).toBeDefined();
    expect(result.miscues.missingWords).toContain('mom');
    expect(result.miscues.extraWords).toContain('dad');
  });

  it('should calculate penalty correctly for adjusted scores', () => {
    const result = validatePronunciation(
      'I love my mom and dad',
      'I love my mom',
      {
        minThreshold: 0.6,
        goodThreshold: 0.8,
      },
    );
    if (result.decision === ValidationDecision.ADJUST_SCORE) {
      expect(result.penalty).toBeGreaterThanOrEqual(0.6);
      expect(result.penalty).toBeLessThan(1.0);
    }
  });

  it('should provide similarity scores', () => {
    const result = validatePronunciation('hello', 'hello');
    expect(result.similarity).toBeDefined();
    expect(result.similarity.jaroWinkler).toBeDefined();
    expect(result.similarity.cosine).toBeDefined();
    expect(result.similarity.levenshtein).toBeDefined();
    expect(result.similarity.combined).toBeDefined();
  });

  it('should handle feedback for missing words', () => {
    const result = validatePronunciation('I love my mom and dad', 'I love');
    expect(result.feedback).toContain('bỏ sót');
  });

  it('should handle feedback for extra words', () => {
    const result = validatePronunciation('hello', 'hello beautiful world');
    expect(result.feedback).toMatch(/nói thêm|thêm từ/);
  });

  it('should handle feedback for both missing and extra words', () => {
    const result = validatePronunciation('I love my mom', 'I love your dad');
    if (result.decision === ValidationDecision.REJECT) {
      expect(result.feedback).toContain('bỏ sót');
      expect(result.feedback).toContain('nói thêm');
    }
  });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('Edge Cases', () => {
  it('should handle Vietnamese characters in transcript', () => {
    const result = validatePronunciation('hello world', 'hello Hạu');
    expect(result.decision).toBeDefined();
    expect([
      ValidationDecision.ADJUST_SCORE,
      ValidationDecision.REJECT,
    ]).toContain(result.decision);
  });

  it('should handle punctuation in phrases', () => {
    const result = validatePronunciation('Hello, world!', 'Hello world');
    expect(result.similarity.combined).toBeGreaterThan(0.95);
  });

  it('should handle extra whitespace', () => {
    const result = validatePronunciation('  hello   world  ', 'hello world');
    expect(result.similarity.combined).toBe(1.0);
  });

  it('should handle single-word phrases', () => {
    const result = validatePronunciation('hello', 'hello');
    expect(result.decision).toBe(ValidationDecision.ACCEPT);
  });

  it('should handle numbers in text', () => {
    const result = validatePronunciation('room 123', 'room 123');
    expect(result.similarity.combined).toBeGreaterThan(0.9);
  });

  it('should handle special characters', () => {
    const result = validatePronunciation('a@b#c', 'abc');
    expect(result.similarity.combined).toBeGreaterThan(0.9);
  });

  it('should handle very long phrases', () => {
    const longPhrase = 'word '.repeat(50).trim();
    const result = validatePronunciation(longPhrase, longPhrase);
    expect(result.decision).toBe(ValidationDecision.ACCEPT);
  });

  it('should handle mixed case consistently', () => {
    const result = validatePronunciation('HeLLo WoRLd', 'hello world');
    expect(result.similarity.combined).toBe(1.0);
  });

  it('should handle repeated punctuation', () => {
    const result = validatePronunciation('hello!!!', 'hello');
    expect(result.similarity.combined).toBeGreaterThan(0.9);
  });

  it('should handle tabs and newlines', () => {
    const result = validatePronunciation('hello\tworld', 'hello world');
    expect(result.similarity.combined).toBe(1.0);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should calculate similarity in <50ms for typical phrase', () => {
    const start = Date.now();
    validatePronunciation(
      'The quick brown fox jumps over the lazy dog',
      'The quick brown fox jumps',
    );
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(50);
  });

  it('should handle long phrases (100+ words) in <200ms', () => {
    const longPhrase = 'word '.repeat(100).trim();
    const start = Date.now();
    validatePronunciation(longPhrase, longPhrase);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  it('should handle multiple calls efficiently', () => {
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      validatePronunciation('hello world', 'hello earth');
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration Tests', () => {
  it('should correctly validate real-world pronunciation scenario', () => {
    const targetPhrase = 'I love my mom and dad';
    const userTranscript = 'I love my mom';

    const result = validatePronunciation(targetPhrase, userTranscript);

    expect(result.decision).toBe(ValidationDecision.ADJUST_SCORE);
    expect(result.miscues.missingWords).toEqual(['and', 'dad']);
    expect(result.penalty).toBeGreaterThan(0.6);
    expect(result.penalty).toBeLessThan(1.0);
    expect(result.feedback).toContain('thiếu từ');
  });

  it('should correctly identify perfect match', () => {
    const phrase = 'The quick brown fox jumps over the lazy dog';
    const result = validatePronunciation(phrase, phrase);

    expect(result.decision).toBe(ValidationDecision.ACCEPT);
    expect(result.penalty).toBe(1.0);
    expect(result.similarity.combined).toBe(1.0);
    expect(result.miscues.missingWords).toHaveLength(0);
    expect(result.miscues.extraWords).toHaveLength(0);
  });

  it('should reject completely wrong transcript', () => {
    const result = validatePronunciation(
      'I love my mom',
      'The cat is on the mat',
    );

    expect(result.decision).toBe(ValidationDecision.REJECT);
    expect(result.penalty).toBe(0);
    expect(result.similarity.combined).toBeLessThan(0.6);
  });
});
