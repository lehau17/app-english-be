import { Injectable, Logger } from '@nestjs/common';
import {
  PronunciationError,
  PhonemeFeedback,
  FeedbackBand,
  FeedbackResult,
  GenerateFeedbackDto,
} from '../dto/feedback.dto';

/**
 * Feedback Generator Service
 * Generate child-friendly Vietnamese feedback for pronunciation practice.
 *
 * Rules:
 * - Point out ONLY 1 main error
 * - Always end with encouragement
 * - Growth mindset messaging
 * - Max 30 words per message
 *
 * Score Bands:
 * - ≥85%: Celebrate (🌟 Tuyệt vời!)
 * - 70-84%: Acknowledge + 1 error (👍 Rất tốt!)
 * - <70%: Encourage + simple instruction (😊 Cố gắng!)
 */
@Injectable()
export class FeedbackGeneratorService {
  private readonly logger = new Logger(FeedbackGeneratorService.name);

  /**
   * Phoneme-specific feedback for Vietnamese speakers
   * Focus on sounds that are difficult for Vietnamese learners
   */
  private readonly PHONEME_FEEDBACK: Record<string, PhonemeFeedback> = {
    θ: {
      instruction: 'Dùng lưỡi chạm nhẹ vào răng trên, thổi hơi ra',
      example: 'THINK không phải SINK',
      tip: 'Đặt lưỡi giữa răng',
    },
    ð: {
      instruction: 'Kẹp lưỡi giữa răng, thổi hơi',
      example: 'THE cat không phải DA cat',
      tip: 'Giống /θ/ nhưng có tiếng',
    },
    r: {
      instruction: 'Lưỡi co lại, không chạm vào gì',
      example: 'RIGHT khác LIGHT',
      tip: 'Cuốn lưỡi nhẹ lên',
    },
    l: {
      instruction: 'Đầu lưỡi chạm vào nướu trên',
      example: 'LIGHT rõ âm L',
      tip: 'Lưỡi chạm nhẹ phía trước',
    },
    v: {
      instruction: 'Răng trên chạm môi dưới, phát tiếng',
      example: 'VERY không phải WERY',
      tip: 'Giữ răng và môi',
    },
    ʃ: {
      instruction: 'Môi tròn, đẩy hơi qua khe răng',
      example: 'SHIP không phải SIP',
      tip: 'Như thì thầm "suỵt"',
    },
    tʃ: {
      instruction: 'Bắt đầu bằng "t" rồi "sh"',
      example: 'CHURCH như CH-urch',
      tip: 'Kết hợp /t/ và /ʃ/',
    },
    dʒ: {
      instruction: 'Bắt đầu bằng "d" rồi "zh"',
      example: 'JUDGE như J-udge',
      tip: 'Kết hợp /d/ và /ʒ/',
    },
    ŋ: {
      instruction: 'Âm "ng" ở cuối từ, trong cổ họng',
      example: 'SING kết thúc bằng NG',
      tip: 'Không có âm /g/ sau',
    },
    z: {
      instruction: 'Như âm /s/ nhưng có tiếng',
      example: 'ZOO không phải SOO',
      tip: 'Rung dây thanh',
    },
    w: {
      instruction: 'Môi tròn nhỏ, nhanh chóng mở ra',
      example: 'WHAT bắt đầu bằng W',
      tip: 'Như đang nói "u" ngắn',
    },
    æ: {
      instruction: 'Miệng mở rộng, âm giữa "a" và "e"',
      example: 'CAT có âm Æ',
      tip: 'Mở miệng hơn "e"',
    },
  };

  /**
   * Celebration phrases for high scores (≥85%)
   */
  private readonly CELEBRATE_PHRASES = [
    'Tuyệt vời!',
    'Xuất sắc!',
    'Chính xác!',
    'Rất giỏi!',
    'Hoàn hảo!',
  ];

  /**
   * Acknowledgement phrases for mid scores (70-84%)
   */
  private readonly ACKNOWLEDGE_PHRASES = [
    'Tốt lắm!',
    'Rất tốt!',
    'Gần đúng rồi!',
    'Bạn đang tiến bộ!',
  ];

  /**
   * Supportive phrases for lower scores (<70%)
   */
  private readonly SUPPORT_PHRASES = [
    'Bạn cố gắng rất tốt!',
    'Không sao đâu!',
    'Thử lại nhé!',
    'Bạn sẽ làm được!',
  ];

  /**
   * Encouraging endings
   */
  private readonly ENCOURAGING_ENDINGS = [
    'Tiếp tục nhé!',
    'Bạn sẽ làm được!',
    'Cố lên!',
    'Hãy thử lại!',
    'Bạn đang tiến bộ!',
  ];

  /**
   * Celebration emojis
   */
  private readonly CELEBRATE_EMOJIS = ['🌟', '⭐', '🎉', '👍', '💪'];

  /**
   * Generate child-friendly feedback based on score and errors
   *
   * @param dto Feedback generation parameters
   * @returns Feedback result with text (and optionally audio)
   */
  generateFeedback(dto: GenerateFeedbackDto): FeedbackResult {
    const { score, errors } = dto;

    this.logger.debug(`Generating feedback for score=${score}, errors=${errors.length}`);

    // Determine score band
    const band = this.getScoreBand(score);

    // Generate feedback text based on band
    let text: string;
    let targetPhoneme: string | undefined;

    switch (band) {
      case FeedbackBand.CELEBRATE:
        text = this.generateCelebrateFeedback(errors[0]);
        targetPhoneme = errors[0]?.phoneme;
        break;
      case FeedbackBand.ACKNOWLEDGE:
        text = this.generateAcknowledgeFeedback(errors[0]);
        targetPhoneme = errors[0]?.phoneme;
        break;
      case FeedbackBand.SUPPORT:
      default:
        text = this.generateSupportFeedback(errors[0]);
        targetPhoneme = errors[0]?.phoneme;
        break;
    }

    // Validate word count (max 30 words)
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 30) {
      this.logger.warn(`Feedback exceeds 30 words (${wordCount}), truncating`);
      text = this.truncateFeedback(text);
    }

    this.logger.log(`Generated ${band} feedback: "${text}" (${wordCount} words)`);

    return {
      text,
      band,
      targetPhoneme,
    };
  }

  /**
   * Get score band based on score
   */
  private getScoreBand(score: number): FeedbackBand {
    if (score >= 85) return FeedbackBand.CELEBRATE;
    if (score >= 70) return FeedbackBand.ACKNOWLEDGE;
    return FeedbackBand.SUPPORT;
  }

  /**
   * Generate celebration feedback (≥85%)
   * Focus on praise, minimal correction
   */
  private generateCelebrateFeedback(error?: PronunciationError): string {
    const emoji = this.pickRandom(this.CELEBRATE_EMOJIS);
    const phrase = this.pickRandom(this.CELEBRATE_PHRASES);

    if (!error) {
      return `${emoji} ${phrase} Bạn phát âm hoàn hảo!`;
    }

    // Even with error, keep positive
    return `${emoji} ${phrase} Chỉ một chút: "${error.word}". ${this.pickRandom(this.ENCOURAGING_ENDINGS)}`;
  }

  /**
   * Generate acknowledgement feedback (70-84%)
   * Praise + 1 specific correction
   */
  private generateAcknowledgeFeedback(error: PronunciationError): string {
    const phrase = this.pickRandom(this.ACKNOWLEDGE_PHRASES);

    if (!error) {
      return `👍 ${phrase} ${this.pickRandom(this.ENCOURAGING_ENDINGS)}`;
    }

    const feedback = this.PHONEME_FEEDBACK[error.phoneme];
    const instruction = feedback?.instruction || error.suggestion;

    return `👍 ${phrase} Chú ý: ${instruction}. ${this.pickRandom(this.ENCOURAGING_ENDINGS)}`;
  }

  /**
   * Generate supportive feedback (<70%)
   * Encourage first, simple instruction
   */
  private generateSupportFeedback(error: PronunciationError): string {
    const phrase = this.pickRandom(this.SUPPORT_PHRASES);

    if (!error) {
      return `😊 ${phrase} ${this.pickRandom(this.ENCOURAGING_ENDINGS)}`;
    }

    const feedback = this.PHONEME_FEEDBACK[error.phoneme];
    const instruction = feedback?.instruction || error.suggestion;

    return `😊 ${phrase} Mẹo: ${instruction}. ${this.pickRandom(this.ENCOURAGING_ENDINGS)}`;
  }

  /**
   * Truncate feedback to max 30 words
   */
  private truncateFeedback(text: string): string {
    const words = text.split(/\s+/);
    if (words.length <= 30) return text;
    return words.slice(0, 28).join(' ') + '... Cố lên!';
  }

  /**
   * Pick random element from array
   */
  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Get phoneme feedback entry
   *
   * @param phoneme IPA phoneme symbol
   * @returns Phoneme feedback or undefined
   */
  getPhonemeFeedback(phoneme: string): PhonemeFeedback | undefined {
    return this.PHONEME_FEEDBACK[phoneme];
  }

  /**
   * Get all supported phonemes
   *
   * @returns List of phoneme symbols
   */
  getSupportedPhonemes(): string[] {
    return Object.keys(this.PHONEME_FEEDBACK);
  }

  /**
   * Validate feedback rules
   *
   * @param feedback Feedback text
   * @returns Validation result
   */
  validateFeedback(feedback: string): {
    valid: boolean;
    wordCount: number;
    hasEncouragement: boolean;
    errors: string[];
  } {
    const words = feedback.split(/\s+/);
    const wordCount = words.length;
    const hasEncouragement = this.ENCOURAGING_ENDINGS.some((e) =>
      feedback.includes(e),
    );

    const errors: string[] = [];
    if (wordCount > 30) {
      errors.push(`Exceeds 30 words (${wordCount})`);
    }
    if (!hasEncouragement) {
      errors.push('Missing encouragement');
    }

    return {
      valid: errors.length === 0,
      wordCount,
      hasEncouragement,
      errors,
    };
  }
}
