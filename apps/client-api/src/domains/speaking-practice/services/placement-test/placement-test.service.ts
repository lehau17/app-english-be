import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';
import {
  PHONEME_TOPIC_MAP,
  PLACEMENT_TEST_ITEMS,
  PlacementTestItemDto,
  PlacementTestResponse,
  PlacementTestResultDto,
  PlacementTestStatusDto,
  SubmitPlacementResponseDto,
} from '../../dto/placement-test.dto';

// Import from script - relative path from this file (7 levels up to root)
const categoryMapping = require('../../../../../../../scripts/speaking-practice-category-mapping');
const TOPIC_CATEGORIES = categoryMapping.TOPIC_CATEGORIES;

/**
 * Placement Test Service
 * Assesses user pronunciation ability and provides personalized topic recommendations
 */
@Injectable()
export class PlacementTestService {
  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Get placement test status for user
   * Check if user has test record and existing practice data
   */
  async getStatus(userId: string): Promise<PlacementTestStatusDto> {
    // Check for existing placement test
    const test = await this.prisma.speakingPlacementTest.findUnique({
      where: { userId },
    });

    // Check if user can skip test (has existing practice data)
    const canSkip = await this.userHasExistingData(userId);

    if (!test) {
      return {
        status: 'not_started',
        progress: 0,
        canSkip,
      };
    }

    const responses = (test.responses as any[]) || [];
    const currentItemIndex = responses.length;
    const totalItems = PLACEMENT_TEST_ITEMS.length;

    return {
      status: test.status as 'not_started' | 'in_progress' | 'completed',
      currentItemIndex,
      totalItems,
      progress: Math.round((currentItemIndex / totalItems) * 100),
      canSkip,
    };
  }

  /**
   * Start or resume placement test
   * Returns current test item
   */
  async startTest(userId: string): Promise<PlacementTestItemDto> {
    // Get or create test record
    let test = await this.prisma.speakingPlacementTest.findUnique({
      where: { userId },
    });

    if (!test) {
      test = await this.prisma.speakingPlacementTest.create({
        data: {
          userId,
          status: 'in_progress',
          startedAt: new Date(),
          testItems: PLACEMENT_TEST_ITEMS as any,
          responses: [],
        },
      });
    } else if (test.status === 'not_started') {
      test = await this.prisma.speakingPlacementTest.update({
        where: { userId },
        data: {
          status: 'in_progress',
          startedAt: new Date(),
          testItems: PLACEMENT_TEST_ITEMS as any,
          responses: [],
        },
      });
    }

    // Get current item based on responses
    const responses = (test.responses as any[]) || [];
    const currentIndex = responses.length;

    if (currentIndex >= PLACEMENT_TEST_ITEMS.length) {
      throw new Error('Test already completed');
    }

    const currentItem = PLACEMENT_TEST_ITEMS[currentIndex];

    return {
      item: currentItem,
      itemIndex: currentIndex,
      totalItems: PLACEMENT_TEST_ITEMS.length,
      isLast: currentIndex === PLACEMENT_TEST_ITEMS.length - 1,
    };
  }

  /**
   * Submit response for current test item
   * Returns next item or final results if complete
   */
  async submitResponse(
    userId: string,
    response: SubmitPlacementResponseDto,
  ): Promise<PlacementTestItemDto | PlacementTestResultDto> {
    const test = await this.prisma.speakingPlacementTest.findUnique({
      where: { userId },
    });

    if (!test || test.status !== 'in_progress') {
      throw new Error('No active placement test found');
    }

    // Validate item exists
    const itemIndex = PLACEMENT_TEST_ITEMS.findIndex(
      (item) => item.id === response.itemId,
    );
    if (itemIndex === -1) {
      throw new Error('Invalid item ID');
    }

    // Add response to record
    const responses = (test.responses as any as PlacementTestResponse[]) || [];
    responses.push({
      itemId: response.itemId,
      userTranscript: response.userTranscript,
      audioUrl: response.audioUrl,
      pronunciationScore: response.pronunciationScore,
      phonemeScores: response.phonemeScores || {},
      timestamp: new Date(),
    });

    await this.prisma.speakingPlacementTest.update({
      where: { userId },
      data: { responses: responses as any },
    });

    // Check if test is complete
    if (responses.length >= PLACEMENT_TEST_ITEMS.length) {
      return this.completeTest(userId);
    }

    // Return next item
    const nextIndex = responses.length;
    const nextItem = PLACEMENT_TEST_ITEMS[nextIndex];

    return {
      item: nextItem,
      itemIndex: nextIndex,
      totalItems: PLACEMENT_TEST_ITEMS.length,
      isLast: nextIndex === PLACEMENT_TEST_ITEMS.length - 1,
    };
  }

  /**
   * Skip test and generate recommendations from existing data
   * Only allowed if user has existing practice data
   */
  async skipTest(userId: string): Promise<PlacementTestResultDto> {
    const hasData = await this.userHasExistingData(userId);

    if (!hasData) {
      throw new Error('Cannot skip test without existing practice data');
    }

    return this.generateRecommendationsFromExistingData(userId);
  }

  /**
   * Get completed test results
   */
  async getResults(userId: string): Promise<PlacementTestResultDto | null> {
    const test = await this.prisma.speakingPlacementTest.findUnique({
      where: { userId },
    });

    if (!test || test.status !== 'completed') {
      return null;
    }

    const phonemeAssessment =
      (test.phonemeAssessment as Record<string, number>) || {};
    const topicRecommendations =
      (test.topicRecommendations as Record<string, number>) || {};

    // Identify weak and strong phonemes
    const phonemeEntries = Object.entries(phonemeAssessment);
    const weakPhonemes = phonemeEntries
      .filter(([_, score]) => score < 60)
      .map(([p]) => p);
    const strongPhonemes = phonemeEntries
      .filter(([_, score]) => score >= 80)
      .map(([p]) => p);

    // Get recommended starting topics (tier 1 or user's level)
    const recommendedStartingTopics = Object.entries(topicRecommendations)
      .filter(([_, tier]) => tier <= (test.overallLevel || 1))
      .map(([topic]) => topic)
      .slice(0, 5);

    return {
      overallLevel: test.overallLevel || 1,
      totalScore: test.totalScore || 0,
      phonemeAssessment,
      topicRecommendations,
      weakPhonemes,
      strongPhonemes,
      recommendedStartingTopics,
      message: this.generateResultMessage(
        test.overallLevel || 1,
        weakPhonemes.length,
      ),
    };
  }

  /**
   * Complete test and calculate results
   */
  private async completeTest(userId: string): Promise<PlacementTestResultDto> {
    const test = await this.prisma.speakingPlacementTest.findUnique({
      where: { userId },
    });

    if (!test) {
      throw new Error('Test not found');
    }

    const responses = (test.responses as any as PlacementTestResponse[]) || [];

    // Calculate phoneme assessment
    const phonemeAssessment = this.calculatePhonemeAssessment(responses);

    // Calculate total score
    const totalScore =
      responses.reduce((sum, r) => sum + r.pronunciationScore, 0) /
      responses.length;

    // Determine overall level
    const overallLevel = this.determineOverallLevel(totalScore);

    // Generate topic recommendations
    const topicRecommendations =
      this.generateTopicRecommendations(phonemeAssessment);

    // Identify weak and strong phonemes
    const phonemeEntries = Object.entries(phonemeAssessment);
    const weakPhonemes = phonemeEntries
      .filter(([_, score]) => score < 60)
      .map(([p]) => p);
    const strongPhonemes = phonemeEntries
      .filter(([_, score]) => score >= 80)
      .map(([p]) => p);

    // Get recommended starting topics
    const recommendedStartingTopics = Object.entries(topicRecommendations)
      .filter(([_, tier]) => tier <= overallLevel)
      .map(([topic]) => topic)
      .slice(0, 5);

    // Update test record
    await this.prisma.speakingPlacementTest.update({
      where: { userId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        overallLevel,
        phonemeAssessment,
        topicRecommendations,
        totalScore,
      },
    });

    // Update user progress record
    await this.prisma.speakingPracticeProgress.upsert({
      where: { userId },
      create: {
        userId,
        weakPhonemes,
        strongPhonemes,
      },
      update: {
        weakPhonemes,
        strongPhonemes,
      },
    });

    return {
      overallLevel,
      totalScore,
      phonemeAssessment,
      topicRecommendations,
      weakPhonemes,
      strongPhonemes,
      recommendedStartingTopics,
      message: this.generateResultMessage(overallLevel, weakPhonemes.length),
    };
  }

  /**
   * Calculate phoneme assessment from responses
   * Aggregates phoneme scores and averages per phoneme
   */
  private calculatePhonemeAssessment(
    responses: PlacementTestResponse[],
  ): Record<string, number> {
    const phonemeData: Record<string, { total: number; sum: number }> = {};

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const item = PLACEMENT_TEST_ITEMS[i];

      if (!item) continue;

      // Use phoneme scores from response if available
      if (
        response.phonemeScores &&
        Object.keys(response.phonemeScores).length > 0
      ) {
        for (const [phoneme, score] of Object.entries(response.phonemeScores)) {
          if (!phonemeData[phoneme]) {
            phonemeData[phoneme] = { total: 0, sum: 0 };
          }
          phonemeData[phoneme].total += 1;
          phonemeData[phoneme].sum += score;
        }
      } else {
        // Fallback: distribute item score across target phonemes
        for (const phoneme of item.targetPhonemes) {
          if (!phonemeData[phoneme]) {
            phonemeData[phoneme] = { total: 0, sum: 0 };
          }
          phonemeData[phoneme].total += 1;
          phonemeData[phoneme].sum += response.pronunciationScore;
        }
      }
    }

    // Calculate average per phoneme
    const result: Record<string, number> = {};
    for (const [phoneme, data] of Object.entries(phonemeData)) {
      result[phoneme] = Math.round(data.sum / data.total);
    }

    return result;
  }

  /**
   * Determine overall difficulty level from total score
   * - totalScore >= 80 → 3 (Hard)
   * - totalScore >= 60 → 2 (Medium)
   * - else → 1 (Easy)
   */
  private determineOverallLevel(totalScore: number): number {
    if (totalScore >= 80) return 3;
    if (totalScore >= 60) return 2;
    return 1;
  }

  /**
   * Generate topic recommendations based on phoneme assessment
   * Maps weak phonemes to topics using PHONEME_TOPIC_MAP
   * Lower phoneme score = recommend easier tier
   */
  private generateTopicRecommendations(
    phonemeAssessment: Record<string, number>,
  ): Record<string, number> {
    const recommendations: Record<string, number> = {};

    // Initialize all topics with default tier 2
    for (const category of TOPIC_CATEGORIES) {
      recommendations[category.name] = 2;
    }

    // Calculate average score for each topic based on phoneme mapping
    for (const [phoneme, topics] of Object.entries(PHONEME_TOPIC_MAP)) {
      const score = phonemeAssessment[phoneme];
      if (score === undefined) continue;

      const tier = this.determineOverallLevel(score);

      for (const topic of topics) {
        if (recommendations[topic] === undefined) {
          recommendations[topic] = tier;
        } else {
          // Use average if multiple phonemes map to same topic
          recommendations[topic] = Math.round(
            (recommendations[topic] + tier) / 2,
          );
        }
      }
    }

    return recommendations;
  }

  /**
   * Check if user has existing speaking practice data
   */
  private async userHasExistingData(userId: string): Promise<boolean> {
    const [progress, mispronounceCount, aiSessionCount] = await Promise.all([
      this.prisma.speakingPracticeProgress.findUnique({
        where: { userId },
        select: { totalAttempts: true },
      }),
      this.prisma.mispronounceWord.count({
        where: { userId },
      }),
      this.prisma.aiSpeakingSession.count({
        where: { userId, state: 'success' as any },
      }),
    ]);

    return (
      (progress && progress.totalAttempts > 0) ||
      mispronounceCount > 0 ||
      aiSessionCount > 0
    );
  }

  /**
   * Generate recommendations from existing practice data
   * Uses MispronounceWord and AiSpeakingSession data
   */
  private async generateRecommendationsFromExistingData(
    userId: string,
  ): Promise<PlacementTestResultDto> {
    // Query mispronounced words for phoneme analysis
    const mispronounceWords = await this.prisma.mispronounceWord.findMany({
      where: { userId },
      orderBy: { errorCount: 'desc' },
      take: 50,
    });

    // Query AI speaking sessions for overall score
    const aiSessions = await this.prisma.aiSpeakingSession.findMany({
      where: { userId, state: 'success' as any },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { analytics: true },
    });

    // Extract phoneme data from mispronounce words
    const phonemeErrorCounts: Record<string, number> = {};
    for (const word of mispronounceWords) {
      // Simple heuristic: extract phonemes from error type or analyze word
      const errorType = (word as any).errorType as string;
      if (errorType && errorType.includes('phoneme_')) {
        const phoneme = errorType.replace('phoneme_', '');
        phonemeErrorCounts[phoneme] =
          (phonemeErrorCounts[phoneme] || 0) + word.errorCount;
      }
    }

    // Calculate phoneme assessment (inverse of error count)
    const maxErrors = Math.max(...Object.values(phonemeErrorCounts), 1);
    const phonemeAssessment: Record<string, number> = {};
    for (const [phoneme, errors] of Object.entries(phonemeErrorCounts)) {
      // Convert error count to score (0-100, lower errors = higher score)
      phonemeAssessment[phoneme] = Math.max(
        0,
        100 - (errors / maxErrors) * 100,
      );
    }

    // Calculate overall score from AI sessions
    let totalScore = 70; // Default medium score
    if (aiSessions.length > 0) {
      const scores = aiSessions
        .map((s) => (s.analytics as any)?.pronunciationScore as number)
        .filter((score) => score !== undefined && !isNaN(score));

      if (scores.length > 0) {
        totalScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      }
    }

    const overallLevel = this.determineOverallLevel(totalScore);

    // Generate topic recommendations
    const topicRecommendations =
      this.generateTopicRecommendations(phonemeAssessment);

    // Identify weak and strong phonemes
    const phonemeEntries = Object.entries(phonemeAssessment);
    const weakPhonemes = phonemeEntries
      .filter(([_, score]) => score < 60)
      .map(([p]) => p);
    const strongPhonemes = phonemeEntries
      .filter(([_, score]) => score >= 80)
      .map(([p]) => p);

    // Get recommended starting topics
    const recommendedStartingTopics = Object.entries(topicRecommendations)
      .filter(([_, tier]) => tier <= overallLevel)
      .map(([topic]) => topic)
      .slice(0, 5);

    // Create placement test record
    await this.prisma.speakingPlacementTest.upsert({
      where: { userId },
      create: {
        userId,
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        overallLevel,
        phonemeAssessment,
        topicRecommendations,
        totalScore,
        testItems: [],
        responses: [],
      },
      update: {
        status: 'completed',
        completedAt: new Date(),
        overallLevel,
        phonemeAssessment,
        topicRecommendations,
        totalScore,
      },
    });

    // Update user progress
    await this.prisma.speakingPracticeProgress.upsert({
      where: { userId },
      create: {
        userId,
        weakPhonemes,
        strongPhonemes,
      },
      update: {
        weakPhonemes,
        strongPhonemes,
      },
    });

    return {
      overallLevel,
      totalScore,
      phonemeAssessment,
      topicRecommendations,
      weakPhonemes,
      strongPhonemes,
      recommendedStartingTopics,
      message: this.generateResultMessage(overallLevel, weakPhonemes.length),
    };
  }

  /**
   * Generate user-friendly result message
   */
  private generateResultMessage(level: number, weakCount: number): string {
    const levelMessages = {
      1: 'Great start! Focus on basics to build a strong foundation.',
      2: 'Good progress! You have a solid understanding of pronunciation.',
      3: 'Excellent! You demonstrate advanced pronunciation skills.',
    };

    const message = levelMessages[level] || levelMessages[1];

    if (weakCount > 5) {
      return `${message} Work on ${weakCount} challenging sounds to improve further.`;
    } else if (weakCount > 0) {
      return `${message} Practice a few specific sounds for refinement.`;
    }

    return `${message} Keep up the great work!`;
  }
}
