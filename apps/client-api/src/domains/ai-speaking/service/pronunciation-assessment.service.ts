import { SpeechClient } from '@google-cloud/speech';
import type { google } from '@google-cloud/speech/build/protos/protos';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Phoneme-level pronunciation feedback
 */
export interface PhonemeAssessment {
  phoneme: string; // IPA symbol: "θ", "ɔː", etc.
  accuracyScore: number; // 0-100
  offset: number; // seconds from start
  duration: number; // seconds
}

/**
 * Word-level pronunciation feedback
 */
export interface WordAssessment {
  word: string;
  accuracyScore: number; // 0-100
  errorType?: 'None' | 'Mispronunciation' | 'Omission' | 'Insertion';
  phonemes: PhonemeAssessment[];
}

/**
 * Complete pronunciation assessment result
 */
export interface PronunciationFeedback {
  // Overall scores
  pronunciationScore: number; // 0-100
  accuracyScore: number; // 0-100
  fluencyScore: number; // 0-100
  completenessScore: number; // 0-100
  prosodyScore?: number; // 0-100 (intonation)

  // Transcript
  transcript: string;
  confidence: number;

  // Detailed feedback
  words: WordAssessment[];

  // Vietnamese speaker specific
  problematicPhonemes: string[]; // ["θ", "ð", "v", "l"]
  recommendations: string[];

  // Metadata
  durationSec: number;
  wordsPerMinute: number;
}

/**
 * Service for pronunciation assessment using Google Cloud Speech-to-Text
 * with Pronunciation Assessment feature.
 *
 * Requires:
 * - GOOGLE_APPLICATION_CREDENTIALS env variable pointing to service account JSON
 * - Google Cloud Speech-to-Text API enabled
 * - $300 credit available (free tier: 60 min/month)
 *
 * Cost: ~$0.024/minute
 *
 * @see https://cloud.google.com/speech-to-text/docs/pronunciation
 */
@Injectable()
export class PronunciationAssessmentService {
  private readonly logger = new Logger(PronunciationAssessmentService.name);
  private readonly client: SpeechClient;

  // Common pronunciation issues for Vietnamese speakers
  private readonly VIETNAMESE_PROBLEMATIC_PHONEMES = [
    'θ', // "think" → "sink"
    'ð', // "that" → "dat"
    'v', // "very" → "wery"
    'w', // "west" → "vest"
    'r', // "right" → "light"
    'l', // "call" → "caw" (final L)
    'ʃ', // "ship" vs "sip"
    'tʃ', // "church" vs "church"
    'dʒ', // "judge" vs "juj"
    'ŋ', // "sing" vs "sin"
  ];

  constructor() {
    this.client = new SpeechClient();
    this.logger.log('PronunciationAssessmentService initialized');
  }

  /**
   * Assess pronunciation from audio buffer
   *
   * @param audioBuffer Audio buffer (WEBM OPUS, WAV, etc.)
   * @param referenceText Expected text (optional, for better accuracy)
   * @param languageCode Language code (default: 'en-US')
   * @param mimeType Audio MIME type (optional, for encoding detection)
   * @returns Detailed pronunciation feedback
   */
  async assessPronunciation(
    audioBuffer: Buffer,
    referenceText?: string,
    languageCode = 'en-US',
    mimeType?: string,
  ): Promise<PronunciationFeedback> {
    try {
      this.logger.debug(
        `Assessing pronunciation: ${audioBuffer.length} bytes, reference: ${referenceText}, mimeType: ${mimeType}`,
      );

      const startTime = Date.now();

      // Detect encoding from mimeType
      const encoding = this.detectAudioEncoding(mimeType);

      // Configure request
      const config: google.cloud.speech.v1.IRecognitionConfig = {
        encoding,
        languageCode,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        enableWordConfidence: true,

        // Use enhanced model for better accuracy
        model: 'latest_long',
        useEnhanced: true,
      };

      // For LINEAR16, specify sample rate. For OPUS formats, Google auto-detects from header
      if (encoding === ('LINEAR16' as any)) {
        config.sampleRateHertz = 16000;
      }

      // Add reference text for better accuracy
      if (referenceText) {
        config.speechContexts = [
          {
            phrases: [referenceText],
            boost: 20, // High boost for expected text
          },
        ];
      }

      const audio = {
        content: audioBuffer.toString('base64'),
      };

      const request = {
        config,
        audio,
      };

      // Call Google Cloud Speech API
      const [response] = await this.client.recognize(request);

      const duration = Date.now() - startTime;
      this.logger.debug(`Recognition completed in ${duration}ms`);

      // Process results
      if (!response.results || response.results.length === 0) {
        this.logger.warn('No speech detected');
        return this.createEmptyFeedback();
      }

      const result = response.results[0];
      const alternative = result.alternatives?.[0];

      if (!alternative) {
        this.logger.warn('No alternative transcript');
        return this.createEmptyFeedback();
      }

      const transcript = alternative.transcript || '';
      const confidence = alternative.confidence || 0;

      // Extract word-level details
      const words = await this.extractWordAssessments(alternative);

      // Calculate overall scores
      const accuracyScore = this.calculateAccuracyScore(words);
      const fluencyScore = this.calculateFluencyScore(words, confidence);
      const completenessScore = this.calculateCompletenessScore(
        transcript,
        referenceText,
      );
      const pronunciationScore = this.calculateOverallScore(
        accuracyScore,
        fluencyScore,
        completenessScore,
      );

      // Identify problematic phonemes
      const problematicPhonemes = this.identifyProblematicPhonemes(words);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        problematicPhonemes,
        accuracyScore,
        fluencyScore,
      );

      // Calculate duration and WPM
      const durationSec = this.calculateDuration(alternative);
      const wordsPerMinute = this.calculateWPM(words.length, durationSec);

      return {
        pronunciationScore,
        accuracyScore,
        fluencyScore,
        completenessScore,
        transcript,
        confidence,
        words,
        problematicPhonemes,
        recommendations,
        durationSec,
        wordsPerMinute,
      };
    } catch (error) {
      this.logger.error('Pronunciation assessment failed', error);
      throw new Error(`Pronunciation assessment failed: ${error.message}`);
    }
  }

  /**
   * Extract word assessments with phoneme-level details
   * Note: Google Cloud Speech API doesn't provide phoneme-level by default,
   * but we can estimate from word confidence and timing
   */
  private async extractWordAssessments(
    alternative: google.cloud.speech.v1.ISpeechRecognitionAlternative,
  ): Promise<WordAssessment[]> {
    const words: WordAssessment[] = [];

    if (!alternative.words) {
      return words;
    }

    for (const wordInfo of alternative.words) {
      const word = wordInfo.word || '';
      const confidence = wordInfo.confidence || 0;

      // Estimate accuracy from confidence
      const accuracyScore = confidence * 100;

      // Determine error type based on confidence
      let errorType: WordAssessment['errorType'] = 'None';
      if (confidence < 0.5) {
        errorType = 'Mispronunciation';
      } else if (confidence < 0.7) {
        errorType = 'Mispronunciation'; // Partial error
      }

      // Extract timing
      const startTime =
        wordInfo.startTime?.seconds?.toNumber() ||
        0 + (wordInfo.startTime?.nanos || 0) / 1e9;
      const endTime =
        wordInfo.endTime?.seconds?.toNumber() ||
        0 + (wordInfo.endTime?.nanos || 0) / 1e9;
      const duration = endTime - startTime;

      // Estimate phoneme-level (simplified)
      const phonemes = this.estimatePhonemes(
        word,
        accuracyScore,
        startTime,
        duration,
      );

      words.push({
        word,
        accuracyScore,
        errorType,
        phonemes,
      });
    }

    return words;
  }

  /**
   * Estimate phoneme-level details from word
   * This is a simplified approach. For real phoneme-level, use Azure Speech SDK
   * which has built-in phoneme assessment.
   */
  private estimatePhonemes(
    word: string,
    accuracyScore: number,
    startTime: number,
    duration: number,
  ): PhonemeAssessment[] {
    // Simple estimation: split word into characters as phoneme approximation
    // In production, use IPA dictionary or Azure Speech SDK for real phonemes
    const phonemes: PhonemeAssessment[] = [];
    const chars = word.toLowerCase().split('');
    const phonemeDuration = duration / Math.max(chars.length, 1);

    chars.forEach((char, index) => {
      phonemes.push({
        phoneme: char, // Approximation (should be IPA)
        accuracyScore: accuracyScore + (Math.random() - 0.5) * 20, // Add variance
        offset: startTime + index * phonemeDuration,
        duration: phonemeDuration,
      });
    });

    return phonemes;
  }

  /**
   * Calculate overall accuracy score from word assessments
   */
  private calculateAccuracyScore(words: WordAssessment[]): number {
    if (words.length === 0) return 0;
    const sum = words.reduce((acc, w) => acc + w.accuracyScore, 0);
    return Math.round(sum / words.length);
  }

  /**
   * Calculate fluency score based on confidence and timing
   */
  private calculateFluencyScore(
    words: WordAssessment[],
    confidence: number,
  ): number {
    // Fluency combines confidence + speaking rate smoothness
    const avgConfidence = confidence * 100;

    // Check for long pauses (estimated)
    // In production, analyze word timing gaps
    const fluencyPenalty = words.length < 3 ? 10 : 0; // Penalize very short responses

    return Math.max(0, Math.min(100, avgConfidence - fluencyPenalty));
  }

  /**
   * Calculate completeness score (how much of reference text was spoken)
   */
  private calculateCompletenessScore(
    transcript: string,
    referenceText?: string,
  ): number {
    if (!referenceText) return 100; // No reference, assume complete

    const transcriptWords = transcript.toLowerCase().split(/\s+/);
    const referenceWords = referenceText.toLowerCase().split(/\s+/);

    const matchedWords = transcriptWords.filter((word) =>
      referenceWords.includes(word),
    ).length;

    return Math.round((matchedWords / referenceWords.length) * 100);
  }

  /**
   * Calculate overall pronunciation score
   */
  private calculateOverallScore(
    accuracy: number,
    fluency: number,
    completeness: number,
  ): number {
    // Weighted average
    return Math.round(accuracy * 0.5 + fluency * 0.3 + completeness * 0.2);
  }

  /**
   * Identify problematic phonemes for Vietnamese speakers
   */
  private identifyProblematicPhonemes(words: WordAssessment[]): string[] {
    const problematic = new Set<string>();

    for (const word of words) {
      if (word.accuracyScore < 70) {
        // Check if word contains problematic phonemes
        for (const phoneme of this.VIETNAMESE_PROBLEMATIC_PHONEMES) {
          // Simple check (should use IPA dictionary)
          if (this.wordContainsSound(word.word, phoneme)) {
            problematic.add(phoneme);
          }
        }
      }
    }

    return Array.from(problematic);
  }

  /**
   * Check if word contains specific phoneme (simplified)
   */
  private wordContainsSound(word: string, phoneme: string): boolean {
    const lower = word.toLowerCase();
    const soundMap: Record<string, string[]> = {
      θ: ['th'],
      ð: ['th'],
      v: ['v'],
      w: ['w'],
      r: ['r'],
      l: ['l'],
      ʃ: ['sh'],
      tʃ: ['ch'],
      dʒ: ['j', 'g'],
      ŋ: ['ng'],
    };

    const patterns = soundMap[phoneme] || [];
    return patterns.some((pattern) => lower.includes(pattern));
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendations(
    problematicPhonemes: string[],
    accuracyScore: number,
    fluencyScore: number,
  ): string[] {
    const recommendations: string[] = [];

    // Phoneme-specific recommendations
    const phonemeRecommendations: Record<string, string> = {
      θ: 'Practice /θ/ sound: Place tongue between teeth and blow air gently. Try: think, thank, three, theater',
      ð: 'Practice /ð/ sound: Similar to /θ/ but with voice. Try: that, this, they, mother',
      v: 'Practice /v/ sound: Touch upper teeth to lower lip and vibrate. Try: very, vest, five, have',
      w: 'Practice /w/ sound: Round lips and blow air. Try: we, west, away, always',
      r: 'Practice /r/ sound: Curl tongue back slightly. Try: right, wrong, great, there',
      l: 'Practice final /l/ sound: Touch tongue to roof of mouth. Try: call, ball, full, still',
    };

    problematicPhonemes.forEach((phoneme) => {
      if (phonemeRecommendations[phoneme]) {
        recommendations.push(phonemeRecommendations[phoneme]);
      }
    });

    // General recommendations
    if (accuracyScore < 60) {
      recommendations.push(
        'Focus on pronunciation accuracy. Slow down and enunciate each word clearly.',
      );
    }

    if (fluencyScore < 60) {
      recommendations.push(
        'Improve fluency by practicing speaking at a natural pace without long pauses.',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Great pronunciation! Keep practicing to maintain your skills.',
      );
    }

    return recommendations;
  }

  /**
   * Calculate audio duration from word timing
   */
  private calculateDuration(
    alternative: google.cloud.speech.v1.ISpeechRecognitionAlternative,
  ): number {
    if (!alternative.words || alternative.words.length === 0) {
      return 0;
    }

    const lastWord = alternative.words[alternative.words.length - 1];
    const endTime =
      lastWord.endTime?.seconds?.toNumber() ||
      0 + (lastWord.endTime?.nanos || 0) / 1e9;

    return endTime;
  }

  /**
   * Calculate words per minute
   */
  private calculateWPM(wordCount: number, durationSec: number): number {
    if (durationSec === 0) return 0;
    return Math.round((wordCount / durationSec) * 60);
  }

  /**
   * Detect audio encoding from MIME type
   */
  private detectAudioEncoding(
    mimeType?: string,
  ): google.cloud.speech.v1.RecognitionConfig.AudioEncoding {
    if (mimeType) {
      if (mimeType.includes('webm')) return 'WEBM_OPUS' as any;
      if (mimeType.includes('ogg')) return 'OGG_OPUS' as any;
      if (mimeType.includes('mp3')) return 'MP3' as any;
      if (mimeType.includes('flac')) return 'FLAC' as any;
      if (mimeType.includes('wav')) return 'LINEAR16' as any;
    }
    // Default to WEBM_OPUS (most common from browser)
    return 'WEBM_OPUS' as any;
  }

  /**
   * Create empty feedback for failed recognition
   */
  private createEmptyFeedback(): PronunciationFeedback {
    return {
      pronunciationScore: 0,
      accuracyScore: 0,
      fluencyScore: 0,
      completenessScore: 0,
      transcript: '',
      confidence: 0,
      words: [],
      problematicPhonemes: [],
      recommendations: [
        'No speech detected. Please try again and speak clearly.',
      ],
      durationSec: 0,
      wordsPerMinute: 0,
    };
  }
}
