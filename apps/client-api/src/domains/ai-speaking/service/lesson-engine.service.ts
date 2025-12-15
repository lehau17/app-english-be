import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DifficultyLevel, SpeakingPracticeLesson } from '@prisma/client';
import { LessonRepository } from '../repository/lesson.repository';
import {
  GenerateLessonDto,
  LessonContentDto,
  LessonItem,
  TurnEvaluationDto,
  DifficultyReductionConfig,
  ConversationMetrics
} from '../dto/lesson.dto';

@Injectable()
export class LessonEngineService {
  private readonly logger = new Logger(LessonEngineService.name);

  // Pass thresholds for each level
  private readonly PASS_THRESHOLDS = {
    1: 80, // Words
    2: 75, // Phrases
    3: 70, // Sentences
    4: 65, // Dialogues
    5: 60  // Free Talk
  };

  // Scoring weights
  private readonly WEIGHTS = {
    pronunciation: 0.4,
    relevance: 0.2,
    fluency: 0.2,
    completeness: 0.2
  };

  constructor(private readonly lessonRepo: LessonRepository) {}

  /**
   * Generate lesson content for user
   * Supports MULTIPLE lessons per level - picks next uncompleted lesson
   */
  async generateLesson(dto: GenerateLessonDto): Promise<LessonContentDto> {
    this.logger.debug(`Generating lesson: level=${dto.level}, userId=${dto.userId}`);

    // Map level to difficulty
    const difficulty = this.mapLevelToDifficulty(dto.level);

    // Fetch NEXT uncompleted lesson for user (supports multiple lessons per level)
    const template = await this.lessonRepo.findNextLessonForUser(
      dto.userId,
      dto.level,
      difficulty
    );
    if (!template) {
      // All lessons at this level completed - return first lesson for review
      this.logger.log(`User ${dto.userId} completed all lessons at level ${dto.level}, returning first for review`);
      const allLessons = await this.lessonRepo.findAllLessonsAtLevel(dto.level, difficulty);
      if (allLessons.length === 0) {
        throw new NotFoundException(`No lesson template found for level ${dto.level}`);
      }
      return this.buildLessonContent(allLessons[0], dto.weakPhonemes);
    }

    return this.buildLessonContent(template, dto.weakPhonemes);
  }

  /**
   * Build lesson content from template
   */
  private async buildLessonContent(
    template: SpeakingPracticeLesson,
    weakPhonemes?: string[]
  ): Promise<LessonContentDto> {
    let items: LessonItem[] = this.extractLessonItems(template);

    // If user has weak phonemes, insert remedial drills
    if (weakPhonemes && weakPhonemes.length > 0) {
      const remedialDrills = await this.lessonRepo.findRemedialDrills(
        weakPhonemes,
        template.level
      );
      const remedialItems = remedialDrills.flatMap(drill => this.extractLessonItems(drill));
      items = [...remedialItems.slice(0, 2), ...items]; // Insert 2 remedial items first
    }

    return {
      id: template.id,
      level: template.level,
      levelName: template.levelName,
      type: template.type as any,
      items,
      passThreshold: template.passThreshold,
      reductionConfig: template.reductionConfig as DifficultyReductionConfig
    };
  }

  /**
   * Evaluate a single turn
   */
  evaluateTurn(
    metrics: ConversationMetrics,
    passThreshold: number,
    attemptNumber: number
  ): TurnEvaluationDto {
    const weightedScore = this.calculateWeightedScore({
      pronunciation: metrics.pronunciationScore,
      relevance: metrics.relevanceScore,
      fluency: metrics.fluencyScore,
      completeness: metrics.completenessScore
    });

    const passed = weightedScore >= passThreshold;
    const shouldRetry = !passed && attemptNumber < 3;
    const shouldReduceDifficulty = attemptNumber >= 2 && !passed;

    let verdict: 'pass' | 'fail' | 'retry' = passed ? 'pass' : 'fail';
    if (shouldRetry) verdict = 'retry';

    let nextAction: TurnEvaluationDto['nextAction'] = 'continue';
    if (shouldReduceDifficulty) nextAction = 'reduce_difficulty';
    else if (shouldRetry) nextAction = 'retry';
    else if (passed) nextAction = 'continue';

    return {
      verdict,
      weightedScore,
      breakdown: {
        pronunciation: metrics.pronunciationScore,
        relevance: metrics.relevanceScore,
        fluency: metrics.fluencyScore,
        completeness: metrics.completenessScore
      },
      shouldReduceDifficulty,
      nextAction,
      feedback: this.generateFeedbackMessage(verdict, weightedScore)
    };
  }

  /**
   * Check if should reduce difficulty
   */
  shouldReduceDifficulty(consecutiveFailures: number): boolean {
    return consecutiveFailures >= 2;
  }

  /**
   * Apply difficulty reduction to lesson
   */
  applyDifficultyReduction(lesson: LessonContentDto): LessonContentDto {
    const defaultReduction: DifficultyReductionConfig = {
      speechRate: 0.8,
      showTranscript: true,
      allowRepeat: true,
      timeoutExtensionMs: 2000,
      simplifyWords: true
    };

    return {
      ...lesson,
      reductionConfig: lesson.reductionConfig || defaultReduction
    };
  }

  /**
   * Calculate weighted score
   */
  private calculateWeightedScore(scores: {
    pronunciation: number;
    relevance: number;
    fluency: number;
    completeness: number;
  }): number {
    return Math.round(
      scores.pronunciation * this.WEIGHTS.pronunciation +
      scores.relevance * this.WEIGHTS.relevance +
      scores.fluency * this.WEIGHTS.fluency +
      scores.completeness * this.WEIGHTS.completeness
    );
  }

  /**
   * Determine next level based on success rate
   */
  determineNextLevel(currentLevel: number, successRate: number): number {
    if (successRate > 0.75 && currentLevel < 5) {
      return currentLevel + 1; // Level up
    }
    if (successRate < 0.5 && currentLevel > 1) {
      return currentLevel - 1; // Level down
    }
    return currentLevel; // Stay same
  }

  /**
   * Map level to difficulty enum
   */
  private mapLevelToDifficulty(level: number): DifficultyLevel {
    const mapping = {
      1: DifficultyLevel.beginner,
      2: DifficultyLevel.elementary,
      3: DifficultyLevel.intermediate,
      4: DifficultyLevel.upper_intermediate,
      5: DifficultyLevel.advanced
    };
    return mapping[level] || DifficultyLevel.beginner;
  }

  /**
   * Extract items from template content
   */
  private extractLessonItems(template: any): LessonItem[] {
    const content = template.content as any;
    const items: LessonItem[] = [];

    if (content.items) {
      // Levels 1-3: simple items
      content.items.forEach((item: string, index: number) => {
        const prompt = content.ai_prompts[index % content.ai_prompts.length];
        items.push({
          content: item,
          aiPrompt: prompt.replace('{word}', item).replace('{phrase}', item).replace('{sentence}', item),
          expectedResponse: [item],
          targetPhonemes: template.targetPhonemes,
          attemptNumber: 1,
          maxRetries: 3
        });
      });
    }

    if (content.exchanges) {
      // Level 4: dialogues
      content.exchanges.forEach((exchange: any) => {
        items.push({
          content: exchange.ai,
          aiPrompt: exchange.ai,
          expectedResponse: exchange.expected_user,
          targetPhonemes: template.targetPhonemes,
          attemptNumber: 1,
          maxRetries: 3
        });
      });
    }

    if (content.topics) {
      // Level 5: free talk
      content.topics.forEach((topic: string) => {
        items.push({
          content: topic,
          aiPrompt: content.ai_prompts[0].replace('{topic}', topic),
          expectedResponse: [], // Free talk has no fixed response
          targetPhonemes: template.targetPhonemes,
          attemptNumber: 1,
          maxRetries: 3
        });
      });
    }

    return items;
  }

  /**
   * Generate feedback message
   */
  private generateFeedbackMessage(verdict: string, score: number): string {
    if (verdict === 'pass') {
      return `Great job! Score: ${score}%`;
    }
    if (verdict === 'retry') {
      return `Try again! Current score: ${score}%`;
    }
    return `Let's practice more. Score: ${score}%`;
  }
}
