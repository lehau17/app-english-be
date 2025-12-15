/**
 * DTOs for Child-Friendly Feedback System
 * AI Speaking Practice - Vietnamese Audio Feedback
 */

/**
 * Pronunciation error details
 */
export interface PronunciationError {
  /**
   * IPA phoneme symbol (e.g., "θ", "ð", "r")
   */
  phoneme: string;

  /**
   * The word containing the error
   */
  word: string;

  /**
   * Simplified instruction for the child
   */
  suggestion: string;
}

/**
 * Phoneme feedback entry with Vietnamese instructions
 */
export interface PhonemeFeedback {
  /**
   * Vietnamese instruction for pronunciation
   */
  instruction: string;

  /**
   * Example showing correct vs incorrect
   */
  example: string;

  /**
   * Optional tip for parents/teachers
   */
  tip?: string;
}

/**
 * Score band categories
 */
export enum FeedbackBand {
  CELEBRATE = 'celebrate', // ≥85%: 🌟 Tuyệt vời!
  ACKNOWLEDGE = 'acknowledge', // 70-84%: 👍 Rất tốt!
  SUPPORT = 'support', // <70%: 😊 Cố gắng!
}

/**
 * Feedback result with text and audio
 */
export interface FeedbackResult {
  /**
   * Feedback text (Vietnamese, max 30 words)
   */
  text: string;

  /**
   * Score band used
   */
  band: FeedbackBand;

  /**
   * Phoneme addressed (if any)
   */
  targetPhoneme?: string;

  /**
   * Audio buffer (Vietnamese TTS)
   */
  audioBuffer?: Buffer;

  /**
   * Audio URL (if stored)
   */
  audioUrl?: string;
}

/**
 * Generate feedback DTO
 */
export class GenerateFeedbackDto {
  /**
   * Score from pronunciation assessment (0-100)
   */
  score: number;

  /**
   * List of pronunciation errors (usually 1-3)
   */
  errors: PronunciationError[];

  /**
   * Whether to generate audio feedback
   */
  generateAudio?: boolean;

  /**
   * Language for feedback (default: 'vi')
   */
  language?: 'vi' | 'en';
}
