/**
 * DTOs for Pronunciation Scoring Service
 * AI Speaking Practice - MVP Scoring System
 */

/**
 * Input DTO for pronunciation assessment with scoring
 */
export class AssessWithScoringDto {
  /**
   * Audio buffer (WEBM OPUS, WAV, etc.)
   */
  audioBuffer: Buffer;

  /**
   * Expected reference text for comparison
   */
  referenceText: string;

  /**
   * Language code (default: 'en-US')
   */
  languageCode?: string;

  /**
   * Audio MIME type for encoding detection
   */
  mimeType?: string;
}

/**
 * Score breakdown details
 */
export class ScoreBreakdownDto {
  /**
   * Google Cloud Speech confidence score (0-100)
   */
  confidence: number;

  /**
   * Levenshtein distance score component (0-100)
   */
  levenshteinDistance: number;

  /**
   * Keyword match score component (0-100)
   */
  keywordMatch: number;
}

/**
 * AI Decision result for pronunciation assessment
 * 100% automated - NO human review required
 */
export class ScoringResultDto {
  /**
   * AI Decision (100% automated):
   * - 'accept': Score ≥75 (Pass)
   * - 'retry': Score <75 (Request repeat)
   */
  decision: 'accept' | 'retry';

  /**
   * Combined pronunciation score (0-100)
   * Formula: avgConfidence × 0.5 + (1 - min(distance/5, 1)) × 0.3 + (keywordMatch/100) × 0.2
   */
  combinedScore: number;

  /**
   * Detailed score breakdown
   */
  breakdown: ScoreBreakdownDto;

  /**
   * Failed phonemes for Vietnamese speakers
   * E.g., ["θ", "ð", "r", "v"]
   */
  failedPhonemes: string[];

  /**
   * Personalized recommendations for improvement
   */
  recommendations: string[];
}

/**
 * Enhanced pronunciation feedback with MVP scoring
 * Extends basic assessment with AI decision logic
 */
export class EnhancedPronunciationFeedbackDto {
  // Overall scores
  pronunciationScore: number; // 0-100
  accuracyScore: number; // 0-100
  fluencyScore: number; // 0-100
  completenessScore: number; // 0-100
  prosodyScore?: number; // 0-100 (optional)

  // Transcript
  transcript: string;
  confidence: number; // 0-1

  // Detailed word-level feedback
  words: Array<{
    word: string;
    accuracyScore: number;
    errorType?: 'None' | 'Mispronunciation' | 'Omission' | 'Insertion';
  }>;

  // Vietnamese speaker specific
  problematicPhonemes: string[];
  recommendations: string[];

  // Metadata
  durationSec: number;
  wordsPerMinute: number;

  // MVP Scoring additions
  /**
   * Levenshtein edit distance between transcript and reference
   */
  levenshteinDistance: number;

  /**
   * Percentage of keywords matched (0-100)
   */
  keywordMatchPercent: number;

  /**
   * Combined score using MVP formula (0-100)
   */
  combinedScore: number;

  /**
   * AI Decision (100% automated, NO human review):
   * - 'accept': Score ≥75 (Pass)
   * - 'retry': Score <75 (Request repeat)
   */
  decision: 'accept' | 'retry';

  /**
   * Failed phonemes identified from low-confidence words
   */
  failedPhonemes: string[];
}
