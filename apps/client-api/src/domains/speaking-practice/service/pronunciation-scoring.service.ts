import { Injectable, Logger } from '@nestjs/common';
import { PronunciationAssessmentService } from '../../ai-speaking/service/pronunciation-assessment.service';
import {
  levenshteinDistance,
  matchKeywords,
  calculateCombinedScore,
  extractFailedPhonemes,
} from './pronunciation-scoring.util';
import {
  AssessWithScoringDto,
  ScoringResultDto,
  EnhancedPronunciationFeedbackDto,
  ScoreBreakdownDto,
} from '../dto/pronunciation-scoring.dto';

/**
 * Pronunciation Scoring Service
 * MVP implementation for AI Speaking Practice with automated decision logic.
 *
 * Features:
 * - Levenshtein distance calculation for text similarity
 * - Keyword matching with fuzzy tolerance
 * - Combined scoring algorithm (confidence + distance + keywords)
 * - 100% automated AI decision (NO human review)
 * - Failed phoneme identification for Vietnamese speakers
 *
 * Decision Logic:
 * - Score ≥75: Accept (Pass)
 * - Score <75: Retry (Request repeat)
 *
 * Formula:
 * finalScore = avgConfidence × 0.5 + (1 - min(distance/5, 1)) × 0.3 + (keywordMatch/100) × 0.2
 */
@Injectable()
export class PronunciationScoringService {
  private readonly logger = new Logger(PronunciationScoringService.name);

  // AI Decision threshold (100% automated, NO human review)
  private readonly ACCEPT_THRESHOLD = 75; // Score ≥75 = Accept
  private readonly ACCURACY_THRESHOLD = 70; // For phoneme extraction

  constructor(
    private readonly pronunciationAssessmentService: PronunciationAssessmentService,
  ) {
    this.logger.log('PronunciationScoringService initialized with MVP scoring');
  }

  /**
   * Enhanced pronunciation assessment with MVP scoring algorithm
   * This method integrates Google Cloud Speech assessment with custom scoring logic.
   *
   * @param dto Assessment input containing audio buffer and reference text
   * @returns Enhanced feedback with AI decision and detailed scoring
   */
  async assessWithMvpScoring(
    dto: AssessWithScoringDto,
  ): Promise<EnhancedPronunciationFeedbackDto> {
    try {
      this.logger.debug(
        `Starting MVP scoring assessment for reference: "${dto.referenceText}"`,
      );

      const startTime = Date.now();

      // Step 1: Get basic assessment from Google Cloud Speech
      const basicAssessment =
        await this.pronunciationAssessmentService.assessPronunciation(
          dto.audioBuffer,
          dto.referenceText,
          dto.languageCode || 'en-US',
          dto.mimeType,
        );

      this.logger.debug(
        `Basic assessment completed: confidence=${basicAssessment.confidence}, transcript="${basicAssessment.transcript}"`,
      );

      // Step 2: Calculate Levenshtein distance
      const distance = levenshteinDistance(
        basicAssessment.transcript,
        dto.referenceText,
      );

      this.logger.debug(`Levenshtein distance: ${distance}`);

      // Step 3: Keyword matching
      const keywordResults = matchKeywords(
        basicAssessment.transcript,
        dto.referenceText,
      );

      this.logger.debug(
        `Keyword match: ${keywordResults.matchPercent.toFixed(2)}% (${keywordResults.matched.length}/${keywordResults.matched.length + keywordResults.missing.length} matched)`,
      );

      // Step 4: Calculate combined score using MVP formula
      const combinedScore = calculateCombinedScore(
        basicAssessment.confidence,
        distance,
        keywordResults.matchPercent,
      );

      this.logger.debug(`Combined score: ${combinedScore}/100`);

      // Step 5: AI Decision (100% automated, NO human review)
      const decision =
        combinedScore >= this.ACCEPT_THRESHOLD ? 'accept' : 'retry';

      this.logger.log(
        `AI Decision: ${decision.toUpperCase()} (score=${combinedScore}, threshold=${this.ACCEPT_THRESHOLD})`,
      );

      // Step 6: Extract failed phonemes from low-confidence words
      const failedPhonemes = extractFailedPhonemes(
        basicAssessment.words,
        this.ACCURACY_THRESHOLD,
      );

      if (failedPhonemes.length > 0) {
        this.logger.debug(
          `Failed phonemes identified: ${failedPhonemes.join(', ')}`,
        );
      }

      // Step 7: Generate enhanced recommendations
      const enhancedRecommendations = this.generateEnhancedRecommendations(
        basicAssessment.recommendations,
        decision,
        combinedScore,
        failedPhonemes,
        keywordResults.missing,
      );

      const duration = Date.now() - startTime;
      this.logger.debug(`MVP scoring completed in ${duration}ms`);

      // Return enhanced feedback
      return {
        ...basicAssessment,
        levenshteinDistance: distance,
        keywordMatchPercent: keywordResults.matchPercent,
        combinedScore,
        decision,
        failedPhonemes,
        recommendations: enhancedRecommendations,
      };
    } catch (error) {
      this.logger.error('MVP scoring assessment failed', error);
      throw new Error(
        `Pronunciation scoring failed: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Get scoring result summary (simplified response)
   *
   * @param dto Assessment input
   * @returns Compact scoring result with decision and breakdown
   */
  async getScoringResult(dto: AssessWithScoringDto): Promise<ScoringResultDto> {
    const fullAssessment = await this.assessWithMvpScoring(dto);

    const breakdown: ScoreBreakdownDto = {
      confidence: Math.round(fullAssessment.confidence * 100),
      levenshteinDistance: fullAssessment.levenshteinDistance,
      keywordMatch: Math.round(fullAssessment.keywordMatchPercent),
    };

    return {
      decision: fullAssessment.decision,
      combinedScore: fullAssessment.combinedScore,
      breakdown,
      failedPhonemes: fullAssessment.failedPhonemes,
      recommendations: fullAssessment.recommendations,
    };
  }

  /**
   * Generate enhanced recommendations based on scoring results
   * Combines basic recommendations with MVP scoring insights.
   *
   * @param baseRecommendations Basic recommendations from pronunciation assessment
   * @param decision AI decision (accept/retry)
   * @param combinedScore Combined score (0-100)
   * @param failedPhonemes Failed phonemes
   * @param missingKeywords Keywords that were not matched
   * @returns Enhanced recommendation list
   */
  private generateEnhancedRecommendations(
    baseRecommendations: string[],
    decision: 'accept' | 'retry',
    combinedScore: number,
    failedPhonemes: string[],
    missingKeywords: string[],
  ): string[] {
    const recommendations: string[] = [...baseRecommendations];

    // Add decision-specific recommendations
    if (decision === 'accept') {
      recommendations.unshift(
        `Great job! Your pronunciation score is ${combinedScore}/100. Keep up the excellent work!`,
      );
    } else {
      recommendations.unshift(
        `Your pronunciation score is ${combinedScore}/100. Let's try again to improve!`,
      );

      // Add specific guidance for missing keywords
      if (missingKeywords.length > 0) {
        const keywordList = missingKeywords.slice(0, 3).join(', ');
        recommendations.push(
          `Try to pronounce these words more clearly: ${keywordList}`,
        );
      }

      // Add phoneme-specific guidance
      if (failedPhonemes.length > 0) {
        recommendations.push(
          `Focus on practicing these sounds: ${failedPhonemes.join(', ')}`,
        );
      }
    }

    // Performance-based recommendations
    if (combinedScore >= 90) {
      recommendations.push(
        'Excellent pronunciation! You can move to harder exercises.',
      );
    } else if (combinedScore >= 75 && combinedScore < 90) {
      recommendations.push(
        'Good pronunciation! Keep practicing to reach excellence.',
      );
    } else if (combinedScore >= 60 && combinedScore < 75) {
      recommendations.push(
        "You're making progress! Focus on clarity and try speaking a bit slower.",
      );
    } else {
      recommendations.push(
        'Take your time to pronounce each word clearly. Listen to the example and try again.',
      );
    }

    return recommendations;
  }

  /**
   * Validate scoring thresholds (for testing/debugging)
   *
   * @returns Current threshold configuration
   */
  getThresholds(): {
    acceptThreshold: number;
    accuracyThreshold: number;
  } {
    return {
      acceptThreshold: this.ACCEPT_THRESHOLD,
      accuracyThreshold: this.ACCURACY_THRESHOLD,
    };
  }
}
