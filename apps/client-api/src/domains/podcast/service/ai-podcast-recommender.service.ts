import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import {
  PodcastRecommendationDto,
  RecommendationResponseDto,
  UserProfileSummaryDto,
} from '../dto/podcast-recommendation.dto';

interface UserProfile {
  userId: string;
  currentLevel: string;
  completedPodcasts: number;
  averageScore: number;
  recentCategories: string[];
  recentDifficulties: string[];
  weakAreas: string[];
  strongAreas: string[];
  learningGoals: string[];
}

interface GeminiRecommendation {
  podcastId: string;
  reason: string;
  matchScore: number;
  difficultyMatch: string;
  topicRelevance: string;
  learningGoalAlignment: string;
}

@Injectable()
export class AiPodcastRecommenderService {
  private readonly logger = new Logger(AiPodcastRecommenderService.name);

  constructor(
    private readonly prisma: PrismaRepository,
    private readonly geminiService: GeminiService,
  ) {}

  /**
   * Get personalized podcast recommendations using AI
   */
  async getPersonalizedRecommendations(
    userId: string,
    limit: number = 10,
  ): Promise<RecommendationResponseDto> {
    this.logger.log(
      `Generating AI recommendations for user ${userId}, limit: ${limit}`,
    );

    try {
      // Step 1: Analyze user profile
      const userProfile = await this.analyzeUserProfile(userId);

      // Step 2: Get available podcasts
      const availablePodcasts = await this.getAvailablePodcasts(userId);

      if (availablePodcasts.length === 0) {
        this.logger.warn('No podcasts available for recommendations');
        return this.getEmptyRecommendations(userProfile);
      }

      // Step 3: Build AI prompt
      const prompt = this.buildRecommendationPrompt(
        userProfile,
        availablePodcasts,
        limit,
      );

      // Step 4: Call Gemini AI
      const aiRecommendations = await this.callGeminiAI(prompt);

      // Step 5: Map AI response to full podcast objects
      const recommendations = await this.mapRecommendationsToPodcasts(
        aiRecommendations,
        availablePodcasts,
      );

      return {
        recommendations: recommendations.slice(0, limit),
        userProfile: this.buildUserProfileSummary(userProfile),
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Error generating AI recommendations: ${error.message}`,
        error.stack,
      );
      // Fallback to rule-based recommendations
      return this.getFallbackRecommendations(userId, limit);
    }
  }

  /**
   * Analyze user's learning profile
   */
  private async analyzeUserProfile(userId: string): Promise<UserProfile> {
    // Get user's podcast attempts
    const attempts = await this.prisma.podcastAttempt.findMany({
      where: { userId },
      include: {
        podcast: {
          select: {
            category: true,
            difficulty: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Last 50 attempts
    });

    const completedAttempts = attempts.filter((a) => a.status === 'submitted');
    const totalScore =
      completedAttempts.reduce((sum, a) => sum + (a.scorePercent || 0), 0) /
      (completedAttempts.length || 1);

    // Analyze categories and difficulties
    const recentCategories = [
      ...new Set(
        attempts
          .slice(0, 10)
          .map((a) => a.podcast.category)
          .filter(Boolean),
      ),
    ];
    const recentDifficulties = [
      ...new Set(
        attempts
          .slice(0, 10)
          .map((a) => a.podcast.difficulty)
          .filter(Boolean),
      ),
    ];

    // Determine current level based on average score and recent difficulties
    let currentLevel = 'beginner';
    if (totalScore >= 80 && recentDifficulties.includes('advanced')) {
      currentLevel = 'advanced';
    } else if (
      totalScore >= 70 &&
      recentDifficulties.includes('intermediate')
    ) {
      currentLevel = 'intermediate';
    } else if (totalScore >= 60) {
      currentLevel = 'elementary';
    }

    // Identify weak and strong areas based on scores
    const categoryScores = new Map<string, number[]>();
    completedAttempts.forEach((a) => {
      const cat = a.podcast.category || 'general';
      if (!categoryScores.has(cat)) {
        categoryScores.set(cat, []);
      }
      categoryScores.get(cat)!.push(a.scorePercent || 0);
    });

    const avgCategoryScores = Array.from(categoryScores.entries())
      .map(([cat, scores]) => ({
        category: cat,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    const strongAreas = avgCategoryScores
      .slice(0, 2)
      .map((c) => c.category)
      .filter((c) => c !== 'general');
    const weakAreas = avgCategoryScores
      .slice(-2)
      .map((c) => c.category)
      .filter((c) => c !== 'general');

    return {
      userId,
      currentLevel,
      completedPodcasts: completedAttempts.length,
      averageScore: Math.round(totalScore),
      recentCategories: recentCategories.slice(0, 5),
      recentDifficulties,
      weakAreas,
      strongAreas,
      learningGoals: ['improve listening', 'expand vocabulary'], // Could be from user settings
    };
  }

  /**
   * Get podcasts available for recommendation
   */
  private async getAvailablePodcasts(userId: string) {
    // Get podcasts user hasn't completed yet
    const podcasts = await this.prisma.podcast.findMany({
      where: {
        status: 'published',
        userProgress: {
          none: {
            userId,
            isCompleted: true,
          },
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        difficulty: true,
        duration: true,
        averageRating: true,
        totalRatings: true,
        code: true,
        thumbnailUrl: true,
      },
      take: 100, // Limit to prevent too large prompts
      orderBy: [{ averageRating: 'desc' }, { createdAt: 'desc' }],
    });

    return podcasts;
  }

  /**
   * Build prompt for Gemini AI
   */
  private buildRecommendationPrompt(
    profile: UserProfile,
    podcasts: any[],
    limit: number,
  ): string {
    const podcastsList = podcasts
      .map(
        (p, i) =>
          `${i + 1}. ID: ${p.id}
   Title: "${p.title}"
   Category: ${p.category || 'General'}
   Difficulty: ${p.difficulty || 'intermediate'}
   Duration: ${Math.floor(p.duration / 60)}min
   Rating: ${p.averageRating?.toFixed(1) || 'N/A'} (${p.totalRatings || 0} reviews)
   Description: ${p.description?.substring(0, 100) || 'No description'}`,
      )
      .join('\n\n');

    return `You are an expert English learning advisor. Analyze the student profile below and recommend the best podcasts for them.

**Student Profile:**
- Current Level: ${profile.currentLevel}
- Completed Podcasts: ${profile.completedPodcasts}
- Average Score: ${profile.averageScore}%
- Recent Topics: ${profile.recentCategories.join(', ') || 'None yet'}
- Recent Difficulties: ${profile.recentDifficulties.join(', ') || 'None yet'}
- Strong Areas: ${profile.strongAreas.join(', ') || 'To be determined'}
- Weak Areas: ${profile.weakAreas.join(', ') || 'To be determined'}
- Learning Goals: ${profile.learningGoals.join(', ')}

**Available Podcasts:**
${podcastsList}

**Task:**
Select the top ${limit} podcasts that would be MOST beneficial for this student. For each recommendation, provide:
1. Clear reasoning why it's a good fit
2. Match score (0-100)
3. How well the difficulty matches their level
4. Topic relevance to their interests/goals
5. How it aligns with their learning objectives

Return ONLY a valid JSON array (no markdown, no explanations outside JSON):
[
  {
    "podcastId": "paste-exact-id-here",
    "reason": "Clear, concise explanation (max 2 sentences)",
    "matchScore": 85,
    "difficultyMatch": "One sentence about difficulty fit",
    "topicRelevance": "One sentence about topic match",
    "learningGoalAlignment": "One sentence about goal alignment"
  }
]

IMPORTANT:
- Return EXACTLY ${limit} recommendations
- Use exact podcast IDs from the list above
- Keep all text fields concise and actionable
- Match scores should reflect genuine fit (70-95 range typical)
- Return valid JSON only, no additional text`;
  }

  /**
   * Call Gemini AI and parse response
   */
  private async callGeminiAI(prompt: string): Promise<GeminiRecommendation[]> {
    try {
      const response = await this.geminiService.generateResponse(prompt);
      const text = response.trim();

      // Remove markdown code blocks if present
      let jsonText = text;
      if (text.startsWith('```json')) {
        jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (text.startsWith('```')) {
        jsonText = text.replace(/```\n?/g, '');
      }

      const recommendations = JSON.parse(jsonText.trim());

      if (!Array.isArray(recommendations)) {
        throw new Error('AI response is not an array');
      }

      return recommendations.map((r) => ({
        podcastId: r.podcastId,
        reason: r.reason || 'Recommended for you',
        matchScore: Math.min(Math.max(r.matchScore || 70, 0), 100),
        difficultyMatch: r.difficultyMatch || 'Suitable for your level',
        topicRelevance: r.topicRelevance || 'Interesting topic',
        learningGoalAlignment:
          r.learningGoalAlignment || 'Supports your learning goals',
      }));
    } catch (error) {
      this.logger.error(
        `Failed to parse AI response: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Map AI recommendations to full podcast objects
   */
  private async mapRecommendationsToPodcasts(
    aiRecs: GeminiRecommendation[],
    availablePodcasts: any[],
  ): Promise<PodcastRecommendationDto[]> {
    const podcastMap = new Map(availablePodcasts.map((p) => [p.id, p]));

    const recommendations: PodcastRecommendationDto[] = [];

    for (const aiRec of aiRecs) {
      const podcast = podcastMap.get(aiRec.podcastId);
      if (podcast) {
        recommendations.push({
          podcastId: aiRec.podcastId,
          podcast,
          reason: aiRec.reason,
          matchScore: aiRec.matchScore,
          aiInsights: {
            difficultyMatch: aiRec.difficultyMatch,
            topicRelevance: aiRec.topicRelevance,
            learningGoalAlignment: aiRec.learningGoalAlignment,
          },
        });
      }
    }

    return recommendations;
  }

  /**
   * Build user profile summary for response
   */
  private buildUserProfileSummary(profile: UserProfile): UserProfileSummaryDto {
    return {
      currentLevel: profile.currentLevel,
      recentTopics: profile.recentCategories,
      strengths: profile.strongAreas,
      areasToImprove: profile.weakAreas,
    };
  }

  /**
   * Fallback recommendations when AI fails
   */
  private async getFallbackRecommendations(
    userId: string,
    limit: number,
  ): Promise<RecommendationResponseDto> {
    this.logger.log('Using fallback rule-based recommendations');

    const podcasts = await this.prisma.podcast.findMany({
      where: {
        status: 'published',
        userProgress: {
          none: {
            userId,
            isCompleted: true,
          },
        },
      },
      orderBy: [{ averageRating: 'desc' }, { viewCount: 'desc' }],
      take: limit,
    });

    const recommendations: PodcastRecommendationDto[] = podcasts.map((p) => ({
      podcastId: p.id,
      podcast: p,
      reason: 'Popular podcast recommended by the community',
      matchScore: 75,
      aiInsights: {
        difficultyMatch: 'Suitable for learners',
        topicRelevance: 'Engaging content',
        learningGoalAlignment: 'Helps improve English skills',
      },
    }));

    return {
      recommendations,
      userProfile: {
        currentLevel: 'intermediate',
        recentTopics: [],
        strengths: [],
        areasToImprove: [],
      },
      generatedAt: new Date(),
    };
  }

  /**
   * Return empty recommendations
   */
  private getEmptyRecommendations(
    profile: UserProfile,
  ): RecommendationResponseDto {
    return {
      recommendations: [],
      userProfile: this.buildUserProfileSummary(profile),
      generatedAt: new Date(),
    };
  }
}
