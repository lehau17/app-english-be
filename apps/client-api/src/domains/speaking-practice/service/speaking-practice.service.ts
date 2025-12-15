import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SpeakingPracticeRepository } from '../repository/speaking-practice.repository';
import { PronunciationScoringService } from './pronunciation-scoring.service';
import { FeedbackGeneratorService } from './feedback-generator.service';
import {
  SpeakingPracticeProgressDto,
  NextPracticeItemDto,
  SubmitResultDto,
  PersonalizedDrillDto,
  SubmitAttemptDto,
} from '../dto/speaking-practice-api.dto';
import { FeedbackBand, PronunciationError } from '../dto/feedback.dto';

/**
 * Speaking Practice Service
 * Main orchestration service for Progress-Based AI Speaking Practice
 *
 * Key Features:
 * - Progress-Based: User vào là học tiếp, không cần tạo session
 * - Adaptive difficulty: Giảm độ khó sau 2 failures
 * - Word-Based tracking: Thu thập từ cụ thể user sai
 * - Child-friendly feedback: Vietnamese, max 1 error, always encourage
 */
@Injectable()
export class SpeakingPracticeService {
  private readonly logger = new Logger(SpeakingPracticeService.name);

  // Level configurations
  private readonly LEVEL_NAMES = {
    1: 'Words',
    2: 'Phrases',
    3: 'Sentences',
    4: 'Dialogues',
    5: 'Free Talk',
  };

  private readonly PASS_THRESHOLDS = {
    1: 80,
    2: 75,
    3: 70,
    4: 65,
    5: 60,
  };

  constructor(
    private readonly repository: SpeakingPracticeRepository,
    private readonly scoringService: PronunciationScoringService,
    private readonly feedbackService: FeedbackGeneratorService,
  ) {}

  /**
   * Get user's current progress
   * Progress-Based: always returns existing or creates new
   */
  async getCurrentProgress(userId: string): Promise<SpeakingPracticeProgressDto> {
    this.logger.debug(`Getting progress for user ${userId}`);

    const progress = await this.repository.findOrCreateProgress(userId);
    const successRate = await this.repository.calculateSuccessRate(userId);

    // Check if next level is unlocked (≥75% success rate)
    const nextLevelUnlocked = successRate >= 75 && progress.currentLevel < 5;

    return {
      id: progress.id,
      userId: progress.userId,
      currentLevel: progress.currentLevel,
      currentLevelName: this.LEVEL_NAMES[progress.currentLevel] || 'Words',
      currentLessonId: progress.currentLessonId,
      completedLessons: progress.completedLessons || [],
      totalLessonsCompleted: (progress.completedLessons || []).length,
      weakPhonemes: progress.weakPhonemes || [],
      streakDays: progress.streakDays,
      lastPracticedAt: progress.lastPracticedAt,
      totalPracticeTimeMinutes: progress.totalPracticeTimeMinutes,
      successRate,
      nextLevelUnlocked,
    };
  }

  /**
   * Get next practice item for user
   * Automatically picks next uncompleted lesson
   */
  async getNextItem(
    userId: string,
    options: { level?: number; lessonId?: string; includeRemedial?: boolean } = {},
  ): Promise<NextPracticeItemDto> {
    this.logger.debug(`Getting next item for user ${userId}`, options);

    const progress = await this.repository.findOrCreateProgress(userId);
    const level = options.level || progress.currentLevel;

    // Find lesson
    let lesson;
    if (options.lessonId) {
      lesson = await this.repository.findLessonById(options.lessonId);
    } else {
      lesson = await this.repository.findNextLesson(userId, level);
    }

    if (!lesson) {
      // All lessons completed at this level
      const allLessons = await this.repository.getLessonsAtLevel(level);
      if (allLessons.length === 0) {
        throw new NotFoundException(`No lessons found at level ${level}`);
      }
      lesson = allLessons[0]; // Return first for review
    }

    // Extract content from lesson
    const content = lesson.content as any;
    const items = this.extractItems(content);
    const currentItemIndex = 0; // Start from first item

    if (items.length === 0) {
      throw new BadRequestException('Lesson has no practice items');
    }

    const item = items[currentItemIndex];

    // Update current lesson in progress
    await this.repository.updateProgress(userId, {
      currentLessonId: lesson.id,
      currentLevel: level,
    });

    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      level: lesson.level,
      levelName: lesson.levelName,
      type: lesson.type as any,
      itemIndex: currentItemIndex,
      totalItems: items.length,
      content: item.content,
      aiPrompt: item.aiPrompt,
      referenceText: item.content,
      targetPhonemes: lesson.targetPhonemes || [],
      passThreshold: lesson.passThreshold || this.PASS_THRESHOLDS[level] || 70,
      attemptNumber: 1,
      maxRetries: 3,
      difficultyReduced: false,
    };
  }

  /**
   * Submit practice attempt and get feedback
   * Records mispronounced words, generates child-friendly feedback
   */
  async submitAttempt(
    userId: string,
    dto: SubmitAttemptDto,
    audioBuffer: Buffer,
  ): Promise<SubmitResultDto> {
    this.logger.debug(`Submitting attempt for user ${userId}, lesson ${dto.lessonId}`);

    const progress = await this.repository.findOrCreateProgress(userId);
    const lesson = await this.repository.findLessonById(dto.lessonId);

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Score pronunciation using MVP algorithm
    const scoringResult = await this.scoringService.assessWithMvpScoring({
      audioBuffer,
      referenceText: dto.referenceText,
      languageCode: 'en-US',
    });

    // Map failed phonemes to pronunciation errors
    const errors: PronunciationError[] = scoringResult.failedPhonemes.map((phoneme) => ({
      phoneme,
      word: dto.referenceText.split(' ')[0], // Simplified
      suggestion: this.feedbackService.getPhonemeFeedback(phoneme)?.instruction || 'Practice more',
    }));

    // Generate child-friendly feedback
    const feedback = this.feedbackService.generateFeedback({
      score: scoringResult.combinedScore,
      errors,
    });

    // Record mispronounced words
    const mispronounceWords: string[] = [];
    if (scoringResult.decision === 'retry') {
      const words = scoringResult.words?.filter((w) => w.accuracyScore < 70) || [];
      for (const word of words.slice(0, 3)) {
        await this.repository.recordMispronounceWord(userId, word.word, {
          phoneme: scoringResult.failedPhonemes[0],
          contextSentence: dto.referenceText,
          source: 'practice_mode',
        });
        mispronounceWords.push(word.word);
      }
    }

    // Determine next action
    const passed = scoringResult.decision === 'accept';
    const attemptNumber = dto.attemptNumber || 1;
    let nextAction: SubmitResultDto['nextAction'] = 'next_item';

    if (!passed) {
      if (attemptNumber < 3) {
        nextAction = 'retry';
      } else {
        nextAction = 'next_item'; // Move on after 3 attempts
      }
    } else {
      // Check if lesson completed (simplified: assume single item per submit)
      const content = lesson.content as any;
      const items = this.extractItems(content);
      if (dto.itemIndex >= items.length - 1) {
        nextAction = 'next_lesson';
      }
    }

    // Update progress
    const progressUpdate = {
      levelChanged: false,
      newLevel: undefined as number | undefined,
      lessonCompleted: nextAction === 'next_lesson',
      streakMaintained: true,
    };

    if (nextAction === 'next_lesson') {
      await this.repository.addCompletedLesson(userId, dto.lessonId);

      // Check for level up
      const successRate = await this.repository.calculateSuccessRate(userId);
      if (successRate >= 75 && progress.currentLevel < 5) {
        progressUpdate.levelChanged = true;
        progressUpdate.newLevel = progress.currentLevel + 1;
        await this.repository.updateProgress(userId, {
          currentLevel: progress.currentLevel + 1,
        });
        nextAction = 'level_up';
      }
    }

    // Create attempt record
    await this.repository.createAttempt({
      progress: { connect: { id: progress.id } },
      lesson: { connect: { id: lesson.id } },
      turnResults: {
        itemIndex: dto.itemIndex,
        referenceText: dto.referenceText,
        transcript: scoringResult.transcript,
        score: scoringResult.combinedScore,
      } as Prisma.JsonObject,
      score: scoringResult.combinedScore,
      verdict: passed ? 'pass' : 'fail',
      failedPhonemes: scoringResult.failedPhonemes,
    });

    // Update weak phonemes
    if (scoringResult.failedPhonemes.length > 0) {
      const currentWeak = progress.weakPhonemes || [];
      const newWeak = [...new Set([...currentWeak, ...scoringResult.failedPhonemes])].slice(0, 10);
      await this.repository.updateWeakPhonemes(userId, newWeak);
    }

    return {
      decision: scoringResult.decision,
      score: scoringResult.combinedScore,
      breakdown: {
        pronunciation: scoringResult.pronunciationScore,
        accuracy: scoringResult.accuracyScore,
        fluency: scoringResult.fluencyScore,
        completeness: scoringResult.completenessScore,
      },
      transcript: scoringResult.transcript,
      feedback: {
        text: feedback.text,
        band: feedback.band,
      },
      failedPhonemes: scoringResult.failedPhonemes,
      mispronounceWords,
      nextAction,
      progressUpdate,
    };
  }

  /**
   * Get personalized drills for user
   * Drills are generated by LLM in background
   */
  async getPersonalizedDrills(
    userId: string,
    options: { status?: string; limit?: number } = {},
  ): Promise<PersonalizedDrillDto[]> {
    this.logger.debug(`Getting drills for user ${userId}`);

    const drills = await this.repository.getPersonalizedDrills(userId, options);

    return drills.map((drill) => ({
      id: drill.id,
      generatedAt: drill.createdAt,
      analysis: drill.analysis || '',
      targetWords: drill.targetWords || [],
      targetSentences: drill.targetSentences || [],
      targetPhonemes: drill.targetPhonemes || [],
      priority: drill.priority,
      status: drill.status as 'pending' | 'in_progress' | 'completed',
    }));
  }

  /**
   * Get words due for review (SM-2 spaced repetition)
   * Returns mispronounced words that need review based on nextReviewDate
   */
  async getDueWordsForReview(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{
    words: Array<{
      id: string;
      word: string;
      errorCount: number;
      contextSentence: string | null;
      problematicPhoneme: string | null;
      nextReviewDate: Date;
      interval: number;
      easeFactor: number;
      repetitions: number;
    }>;
    totalDue: number;
    stats: {
      totalWords: number;
      dueToday: number;
      masteredCount: number;
      learningCount: number;
      averageEaseFactor: number;
    };
  }> {
    this.logger.debug(`Getting due words for user ${userId}`);

    const [words, totalDue, stats] = await Promise.all([
      this.repository.getDueWordsForReview(userId, options),
      this.repository.getDueWordsCount(userId),
      this.repository.getSRSStats(userId),
    ]);

    return {
      words: words.map((w) => ({
        id: w.id,
        word: w.word,
        errorCount: w.errorCount,
        contextSentence: w.contextSentence,
        problematicPhoneme: w.problematicPhoneme,
        nextReviewDate: w.nextReviewDate,
        interval: w.interval,
        easeFactor: w.easeFactor,
        repetitions: w.repetitions ?? 0,
      })),
      totalDue,
      stats,
    };
  }

  /**
   * Extract practice items from lesson content
   */
  private extractItems(content: any): Array<{ content: string; aiPrompt: string }> {
    const items: Array<{ content: string; aiPrompt: string }> = [];

    if (content.items) {
      // Levels 1-3: words, phrases, sentences
      const prompts = content.ai_prompts || ['Say: {word}'];
      content.items.forEach((item: string, index: number) => {
        const promptTemplate = prompts[index % prompts.length];
        items.push({
          content: item,
          aiPrompt: promptTemplate
            .replace('{word}', item)
            .replace('{phrase}', item)
            .replace('{sentence}', item),
        });
      });
    }

    if (content.exchanges) {
      // Level 4: dialogues
      content.exchanges.forEach((exchange: any) => {
        items.push({
          content: exchange.expected_user?.[0] || exchange.ai,
          aiPrompt: exchange.ai,
        });
      });
    }

    if (content.topics) {
      // Level 5: free talk
      const prompts = content.ai_prompts || ["Let's talk about {topic}"];
      content.topics.forEach((topic: string) => {
        items.push({
          content: topic,
          aiPrompt: prompts[0].replace('{topic}', topic),
        });
      });
    }

    return items;
  }
}
