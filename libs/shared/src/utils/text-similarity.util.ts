/**
 * Text Similarity Utilities for Pronunciation Evaluation
 *
 * Provides multiple text similarity algorithms to validate
 * pronunciation transcripts against target phrases.
 *
 * Algorithms:
 * - Jaro-Winkler: Word-level similarity (prefix-sensitive)
 * - Cosine: Phrase-level semantic matching
 * - Levenshtein: Edit distance for penalty calculation
 *
 * @module text-similarity
 */

import { compareTwoStrings } from 'string-similarity';
import { distance as levenshtein } from 'fastest-levenshtein';

// ============================================================================
// Interfaces
// ============================================================================

export interface SimilarityScores {
  jaroWinkler: number;
  cosine: number;
  levenshtein: number;
  combined: number;
}

export interface SimilarityConfig {
  jaroWeight: number; // Default: 0.40
  cosineWeight: number; // Default: 0.40
  levenshteinWeight: number; // Default: 0.20
}

export interface MiscueResult {
  extraWords: string[];
  missingWords: string[];
  repeatedWords: string[];
  matchedWords: string[];
}

export enum ValidationDecision {
  ACCEPT = 'accept', // Similarity ≥0.80
  ADJUST_SCORE = 'adjust', // Similarity 0.60-0.79
  REJECT = 'reject', // Similarity <0.60
}

export interface ValidationResult {
  decision: ValidationDecision;
  similarity: SimilarityScores;
  miscues: MiscueResult;
  penalty: number; // 0.0-1.0 multiplier for score adjustment
  feedback: string; // Vietnamese feedback for user
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Calculate Jaro-Winkler similarity between two strings.
 * Returns a score between 0.0 (completely different) and 1.0 (identical).
 *
 * @param s1 - First string to compare
 * @param s2 - Second string to compare
 * @returns Similarity score (0.0-1.0)
 */
export function calculateJaroWinkler(s1: string, s2: string): number {
  // Normalize inputs
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();

  // Handle empty strings
  if (str1.length === 0 && str2.length === 0) {
    return 1.0;
  }
  if (str1.length === 0 || str2.length === 0) {
    return 0.0;
  }

  // Use string-similarity library
  const similarity = compareTwoStrings(str1, str2);
  return similarity; // Returns 0.0-1.0
}

/**
 * Calculate Cosine similarity between two phrases using TF-IDF vectors.
 * Returns a score between 0.0 (no overlap) and 1.0 (identical word sets).
 *
 * @param s1 - First phrase to compare
 * @param s2 - Second phrase to compare
 * @returns Similarity score (0.0-1.0)
 */
export function calculateCosine(s1: string, s2: string): number {
  // Tokenize and create word frequency vectors
  const words1 = tokenize(s1);
  const words2 = tokenize(s2);

  // Handle empty phrases
  if (words1.length === 0 && words2.length === 0) {
    return 1.0;
  }
  if (words1.length === 0 || words2.length === 0) {
    return 0.0;
  }

  // Build vocabulary
  const vocab = new Set([...words1, ...words2]);

  // Create TF vectors
  const vector1 = createTFVector(words1, vocab);
  const vector2 = createTFVector(words2, vocab);

  // Calculate cosine
  return cosineSimilarity(vector1, vector2);
}

/**
 * Calculate Levenshtein edit distance between two strings.
 * Returns both raw distance and normalized score (0.0-1.0).
 *
 * @param s1 - First string to compare
 * @param s2 - Second string to compare
 * @returns Object with distance and normalized similarity
 */
export function calculateLevenshtein(
  s1: string,
  s2: string,
): {
  distance: number;
  normalized: number;
} {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();

  const distance = levenshtein(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  const normalized = maxLen > 0 ? 1 - distance / maxLen : 1.0;

  return { distance, normalized };
}

/**
 * Detect miscues (extra/missing/repeated words) between target and transcript.
 * Useful for providing specific feedback to users.
 *
 * @param targetPhrase - Expected phrase
 * @param transcript - User's actual transcript
 * @returns Miscue analysis result
 */
export function detectMiscues(
  targetPhrase: string,
  transcript: string,
): MiscueResult {
  const targetWords = tokenize(targetPhrase);
  const transcriptWords = tokenize(transcript);

  const targetSet = new Set(targetWords);
  const transcriptSet = new Set(transcriptWords);

  const extraWords = [...transcriptSet].filter((w) => !targetSet.has(w));
  const missingWords = [...targetSet].filter((w) => !transcriptSet.has(w));
  const matchedWords = [...targetSet].filter((w) => transcriptSet.has(w));

  // Detect repeated words
  const wordCounts = countWords(transcriptWords);
  const repeatedWords = Object.entries(wordCounts)
    .filter(([, count]) => count > 1)
    .map(([word]) => word);

  return { extraWords, missingWords, repeatedWords, matchedWords };
}

/**
 * Calculate combined similarity score using weighted average.
 * Combines Jaro-Winkler, Cosine, and Levenshtein scores.
 *
 * @param targetPhrase - Expected phrase
 * @param transcript - User's actual transcript
 * @param config - Optional weight configuration
 * @returns All similarity scores including combined
 */
export function calculateCombinedSimilarity(
  targetPhrase: string,
  transcript: string,
  config?: SimilarityConfig,
): SimilarityScores {
  const weights = {
    jaroWeight: config?.jaroWeight ?? 0.4,
    cosineWeight: config?.cosineWeight ?? 0.4,
    levenshteinWeight: config?.levenshteinWeight ?? 0.2,
  };

  // Validate weights sum to 1.0
  const sum =
    weights.jaroWeight + weights.cosineWeight + weights.levenshteinWeight;
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error('Similarity weights must sum to 1.0');
  }

  const jaroWinkler = calculateJaroWinkler(targetPhrase, transcript);
  const cosine = calculateCosine(targetPhrase, transcript);
  const { normalized: levenshteinNorm } = calculateLevenshtein(
    targetPhrase,
    transcript,
  );

  const combined =
    jaroWinkler * weights.jaroWeight +
    cosine * weights.cosineWeight +
    levenshteinNorm * weights.levenshteinWeight;

  return {
    jaroWinkler,
    cosine,
    levenshtein: levenshteinNorm,
    combined,
  };
}

/**
 * Validate pronunciation transcript against target phrase.
 * Returns decision (accept/adjust/reject) with penalty and feedback.
 *
 * @param targetPhrase - Expected phrase
 * @param transcript - User's actual transcript
 * @param thresholds - Optional custom thresholds
 * @returns Validation result with decision and feedback
 */
export function validatePronunciation(
  targetPhrase: string,
  transcript: string,
  thresholds?: {
    minThreshold?: number; // Default: 0.60
    goodThreshold?: number; // Default: 0.80
  },
): ValidationResult {
  const minThreshold = thresholds?.minThreshold ?? 0.6;
  const goodThreshold = thresholds?.goodThreshold ?? 0.8;

  const similarity = calculateCombinedSimilarity(targetPhrase, transcript);
  const miscues = detectMiscues(targetPhrase, transcript);

  let decision: ValidationDecision;
  let penalty: number;
  let feedback: string;

  if (similarity.combined < minThreshold) {
    decision = ValidationDecision.REJECT;
    penalty = 0;
    feedback = generateRejectFeedback(miscues);
  } else if (similarity.combined < goodThreshold) {
    decision = ValidationDecision.ADJUST_SCORE;
    penalty = calculatePenalty(
      similarity.combined,
      minThreshold,
      goodThreshold,
    );
    feedback = generateAdjustFeedback(miscues);
  } else {
    decision = ValidationDecision.ACCEPT;
    penalty = 1.0;
    feedback = 'Nội dung phát âm chính xác!';
  }

  return { decision, similarity, miscues, penalty, feedback };
}

// ============================================================================
// Helper Functions (Internal)
// ============================================================================

/**
 * Tokenize text into lowercase words, removing punctuation.
 * @internal
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Count word occurrences in array.
 * @internal
 */
function countWords(words: string[]): Record<string, number> {
  return words.reduce(
    (acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}

/**
 * Create term frequency vector for given words.
 * @internal
 */
function createTFVector(words: string[], vocab: Set<string>): number[] {
  const wordCounts = countWords(words);
  const totalWords = words.length;

  return [...vocab].map((word) => {
    const count = wordCounts[word] || 0;
    return count / totalWords; // Term frequency
  });
}

/**
 * Calculate cosine similarity between two vectors.
 * @internal
 */
function cosineSimilarity(v1: number[], v2: number[]): number {
  const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  const norm1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
  const norm2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));

  return norm1 * norm2 > 0 ? dotProduct / (norm1 * norm2) : 0;
}

/**
 * Calculate penalty multiplier for score adjustment.
 * Linear interpolation between min and good threshold.
 * @internal
 */
function calculatePenalty(
  similarity: number,
  minThreshold: number,
  goodThreshold: number,
): number {
  // Linear interpolation between min and good threshold
  // similarity 0.60 → penalty 0.60
  // similarity 0.70 → penalty 0.80
  // similarity 0.79 → penalty 0.98
  const range = goodThreshold - minThreshold;
  const position = similarity - minThreshold;
  return minThreshold + (position / range) * (1 - minThreshold);
}

/**
 * Generate Vietnamese feedback for rejected pronunciation.
 * @internal
 */
function generateRejectFeedback(miscues: MiscueResult): string {
  if (miscues.missingWords.length > 0 && miscues.extraWords.length > 0) {
    return `Nội dung phát âm không khớp với câu mục tiêu. Bạn đã bỏ sót: "${miscues.missingWords.join(', ')}" và nói thêm: "${miscues.extraWords.join(', ')}". Vui lòng đọc lại đúng câu.`;
  }
  if (miscues.missingWords.length > 0) {
    return `Bạn đã bỏ sót các từ: "${miscues.missingWords.join(', ')}". Vui lòng đọc đầy đủ câu mục tiêu.`;
  }
  if (miscues.extraWords.length > 0) {
    return `Bạn đã nói thêm các từ: "${miscues.extraWords.join(', ')}". Vui lòng chỉ đọc đúng câu mục tiêu.`;
  }
  return 'Nội dung phát âm không khớp với câu mục tiêu. Vui lòng đọc lại.';
}

/**
 * Generate Vietnamese feedback for adjusted pronunciation.
 * @internal
 */
function generateAdjustFeedback(miscues: MiscueResult): string {
  const issues = [];
  if (miscues.missingWords.length > 0) {
    issues.push(`thiếu từ "${miscues.missingWords.join(', ')}"`);
  }
  if (miscues.extraWords.length > 0) {
    issues.push(`thêm từ "${miscues.extraWords.join(', ')}"`);
  }
  if (miscues.repeatedWords.length > 0) {
    issues.push(`lặp từ "${miscues.repeatedWords.join(', ')}"`);
  }

  if (issues.length > 0) {
    return `Nội dung gần đúng nhưng có một số vấn đề: ${issues.join(', ')}. Hãy cố gắng đọc chính xác hơn.`;
  }
  return 'Nội dung phát âm khá tốt, chỉ cần cải thiện thêm một chút.';
}
