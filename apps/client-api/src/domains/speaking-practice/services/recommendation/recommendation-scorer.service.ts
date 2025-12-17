import { Injectable } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { LessonRecommendation } from './types';
import { recommendationConfig } from '../../config/recommendation.config';
import { PhonemeWeaknessAnalyzerService } from './phoneme-weakness-analyzer.service';
import { TopicFreshnessTrackerService } from './topic-freshness-tracker.service';
import { SuccessRateCalculatorService } from './success-rate-calculator.service';
import { SrsTopicReviewerService } from './srs-topic-reviewer.service';

@Injectable()
export class RecommendationScorerService {
  constructor(
    private prisma: PrismaService,
    private phonemeWeaknessAnalyzer: PhonemeWeaknessAnalyzerService,
    private topicFreshnessTracker: TopicFreshnessTrackerService,
    private successRateCalculator: SuccessRateCalculatorService,
    private srsTopicReviewer: SrsTopicReviewerService,
  ) {}

  async getRecommendations(
    userId: string,
    limit?: number,
  ): Promise<LessonRecommendation[]> {
    const recommendationCount =
      limit || recommendationConfig.defaultRecommendationCount;

    // Gather all recommendation factors in parallel
    const [
      weakPhonemes,
      topicFreshness,
      successRates,
      srsReviews,
      availableLessons,
    ] = await Promise.all([
      this.phonemeWeaknessAnalyzer.getUserWeakPhonemes(userId),
      this.topicFreshnessTracker.getTopicFreshness(userId),
      this.successRateCalculator.getTopicSuccessRates(userId),
      this.srsTopicReviewer.getTopicReviews(userId),
      this.getAvailableLessons(userId),
    ]);

    // Score each lesson
    const scoredLessons = availableLessons.map((lesson) => {
      const reasoning: string[] = [];

      // Factor 1: Weak phoneme match (0.4 weight)
      const phonemeMatchScore = this.calculatePhonemeMatchScore(
        lesson,
        weakPhonemes,
        reasoning,
      );

      // Factor 2: Topic freshness (0.3 weight)
      const freshnessScore = this.calculateFreshnessScore(
        lesson,
        topicFreshness,
        reasoning,
      );

      // Factor 3: Success rate inverse (0.2 weight)
      const successScore = this.calculateSuccessScore(
        lesson,
        successRates,
        reasoning,
      );

      // Factor 4: SRS review due (0.1 weight)
      const srsScore = this.calculateSrsScore(lesson, srsReviews, reasoning);

      // Calculate weighted total score
      const totalScore =
        phonemeMatchScore * recommendationConfig.weights.phonemeMatch +
        freshnessScore * recommendationConfig.weights.topicFreshness +
        successScore * recommendationConfig.weights.successRateInverse +
        srsScore * recommendationConfig.weights.srsReviewDue;

      return {
        lessonId: lesson.id,
        category: lesson.category,
        title: lesson.title,
        difficultyTier: lesson.difficultyTier,
        score: totalScore,
        reasoning,
      };
    });

    // Sort by score (descending) and return top N
    return scoredLessons
      .sort((a, b) => b.score - a.score)
      .slice(0, recommendationCount);
  }

  private async getAvailableLessons(userId: string) {
    // Get user's progress to find completed lessons
    const progress = await this.prisma.speakingPracticeProgress.findUnique({
      where: {
        userId,
      },
      select: {
        completedLessons: true,
      },
    });

    const completedIds = progress?.completedLessons || [];

    // Fetch all active lessons excluding completed ones
    const lessons = await this.prisma.speakingPracticeLesson.findMany({
      where: {
        id: {
          notIn: completedIds,
        },
        isActive: true,
      },
      select: {
        id: true,
        category: true,
        title: true,
        difficultyTier: true,
        targetPhonemes: true,
      },
    });

    return lessons;
  }

  private calculatePhonemeMatchScore(
    lesson: any,
    weakPhonemes: any[],
    reasoning: string[],
  ): number {
    if (weakPhonemes.length === 0) {
      return 0;
    }

    const targetPhonemes = lesson.targetPhonemes || [];
    const matchingPhonemes = targetPhonemes.filter((phoneme: string) =>
      weakPhonemes.some((wp) => wp.phoneme === phoneme),
    );

    if (matchingPhonemes.length > 0) {
      const matchScore = matchingPhonemes.length / targetPhonemes.length;
      reasoning.push(
        `Targets weak phonemes: ${matchingPhonemes.join(', ')} (${(matchScore * 100).toFixed(0)}% match)`,
      );
      return matchScore;
    }

    return 0;
  }

  private calculateFreshnessScore(
    lesson: any,
    topicFreshness: any[],
    reasoning: string[],
  ): number {
    const freshness = topicFreshness.find(
      (f) => f.category === lesson.category,
    );

    if (!freshness) {
      return 0;
    }

    if (freshness.daysSinceLastPractice === Infinity) {
      reasoning.push('Never practiced - high priority');
      return 1.0;
    }

    if (freshness.daysSinceLastPractice > 7) {
      reasoning.push(
        `Last practiced ${freshness.daysSinceLastPractice} days ago`,
      );
    }

    return freshness.freshnessScore;
  }

  private calculateSuccessScore(
    lesson: any,
    successRates: any[],
    reasoning: string[],
  ): number {
    const successRate = successRates.find(
      (sr) => sr.category === lesson.category,
    );

    if (!successRate || successRate.totalAttempts === 0) {
      return 0;
    }

    if (successRate.avgScore < 50) {
      reasoning.push(
        `Low success rate (${successRate.avgScore.toFixed(0)}%) - needs practice`,
      );
    }

    return successRate.successRateInverseFactor;
  }

  private calculateSrsScore(
    lesson: any,
    srsReviews: any[],
    reasoning: string[],
  ): number {
    const srsReview = srsReviews.find((sr) => sr.category === lesson.category);

    if (!srsReview) {
      return 0;
    }

    if (srsReview.isDue) {
      reasoning.push('Due for spaced repetition review');
    }

    return srsReview.srsScore;
  }
}
