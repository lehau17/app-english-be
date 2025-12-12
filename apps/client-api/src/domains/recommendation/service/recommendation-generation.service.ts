import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Course, DifficultyLevel, Lesson, RecommendationType } from '@prisma/client';
import { StudentAnalyticsTool } from '../../agent/tools/student-analytics.tool';
import { CreateRecommendationDto } from '../dto';
import { RecommendationService } from './recommendation.service';

interface RecommendationCandidate {
  type: RecommendationType;
  courseId?: string;
  lessonId?: string;
  activityId?: string;
  podcastId?: string;
  confidence: number;
  reasoning: string;
}

@Injectable()
export class RecommendationGenerationService {
  private readonly logger = new Logger(RecommendationGenerationService.name);

  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly prisma: PrismaRepository,
    private readonly geminiService: GeminiService,
    private readonly analyticsTool: StudentAnalyticsTool,
  ) {}

  /**
   * Generate recommendations for user
   */
  async generateForUser(userId: string, limit: number = 10): Promise<string[]> {
    this.logger.log(`Generating recommendations for user: ${userId}, limit: ${limit}`);

    try {
      // 1. Analyze progress
      const profile = await this.analyzeProgress(userId);

      // 2. Identify weak areas
      const weakAreas = this.identifyWeakAreas(profile);

      // 3. Generate recommendations based on weak areas
      const weakAreaRecs = await this.generateBasedOnWeakAreas(userId, weakAreas);

      // 4. Generate recommendations based on goals
      const goalRecs = await this.generateBasedOnGoals(userId, profile);

      // 5. Combine and rank
      const allCandidates = [...weakAreaRecs, ...goalRecs];
      const ranked = this.rankRecommendations(allCandidates);

      // 6. Create recommendation records
      const recommendationIds: string[] = [];
      for (const candidate of ranked.slice(0, limit)) {
        try {
          const dto: CreateRecommendationDto = {
            userId,
            type: candidate.type,
            courseId: candidate.courseId,
            lessonId: candidate.lessonId,
            activityId: candidate.activityId,
            podcastId: candidate.podcastId,
            confidence: candidate.confidence,
            reasoning: candidate.reasoning,
          };

          const rec = await this.recommendationService.create(dto);
          recommendationIds.push(rec.id);
        } catch (error) {
          this.logger.warn(`Failed to create recommendation: ${error.message}`);
        }
      }

      this.logger.log(`Generated ${recommendationIds.length} recommendations`);
      return recommendationIds;
    } catch (error) {
      this.logger.error(`Error generating recommendations: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate recommendations based on weak areas
   */
  async generateBasedOnWeakAreas(
    userId: string,
    weakAreas: string[],
  ): Promise<RecommendationCandidate[]> {
    if (weakAreas.length === 0) return [];

    this.logger.log(`Generating recommendations for weak areas: ${weakAreas.join(', ')}`);

    // Get student level
    const studentData = await this.analyticsTool.getStudentData(userId, 'all');
    let currentLevel: DifficultyLevel = DifficultyLevel.beginner;
    if (studentData.averageScore >= 80) {
      currentLevel = DifficultyLevel.advanced;
    } else if (studentData.averageScore >= 60) {
      currentLevel = DifficultyLevel.intermediate;
    }

    // Find relevant courses
    const courses = await this.findRelevantCourses(weakAreas, currentLevel);

    // Find relevant lessons (from enrolled courses)
    const lessons = await this.findRelevantLessons(userId, weakAreas, currentLevel);

    // Build candidates
    const candidates: RecommendationCandidate[] = [];

    // Course recommendations
    for (const course of courses.slice(0, 5)) {
      const confidence = this.calculateCourseConfidence(course, weakAreas);
      candidates.push({
        type: RecommendationType.course,
        courseId: course.id,
        confidence,
        reasoning: `Khóa học này tập trung vào ${weakAreas.join(', ')} - phù hợp với điểm yếu của bạn`,
      });
    }

    // Lesson recommendations
    for (const lesson of lessons.slice(0, 5)) {
      const confidence = this.calculateLessonConfidence(lesson, weakAreas);
      candidates.push({
        type: RecommendationType.lesson,
        lessonId: lesson.id,
        courseId: lesson.courseId,
        confidence,
        reasoning: `Bài học này giúp cải thiện ${weakAreas.join(', ')}`,
      });
    }

    return candidates;
  }

  /**
   * Generate recommendations based on goals
   */
  async generateBasedOnGoals(
    userId: string,
    profile: any,
  ): Promise<RecommendationCandidate[]> {
    const candidates: RecommendationCandidate[] = [];

    // Get target level from profile or default
    const targetLevel = profile.goals?.targetLevel || DifficultyLevel.intermediate;
    const focusAreas = profile.goals?.focusAreas || [];

    // Find courses matching goals
    const courses = await this.prisma.course.findMany({
      where: {
        difficulty: targetLevel,
        isPublished: true,
      },
      take: 5,
    });

    for (const course of courses) {
      candidates.push({
        type: RecommendationType.course,
        courseId: course.id,
        confidence: 70,
        reasoning: `Khóa học này phù hợp với mục tiêu ${targetLevel} của bạn`,
      });
    }

    return candidates;
  }

  /**
   * Analyze student progress
   */
  private async analyzeProgress(userId: string): Promise<any> {
    const studentData = await (this.analyticsTool as any).getStudentData(userId, 'all');
    return studentData;
  }

  /**
   * Identify weak areas from profile
   */
  private identifyWeakAreas(profile: any): string[] {
    const weakAreas: string[] = [];
    const skillBreakdown = profile.skillBreakdown || {};

    if (skillBreakdown.grammar < 60) weakAreas.push('grammar');
    if (skillBreakdown.vocabulary < 60) weakAreas.push('vocabulary');
    if (skillBreakdown.listening < 60) weakAreas.push('listening');
    if (skillBreakdown.speaking < 60) weakAreas.push('speaking');
    if (skillBreakdown.reading < 60) weakAreas.push('reading');
    if (skillBreakdown.writing < 60) weakAreas.push('writing');

    // If no weak areas, use lowest skill
    if (weakAreas.length === 0) {
      const skills = [
        { name: 'grammar', score: skillBreakdown.grammar || 0 },
        { name: 'vocabulary', score: skillBreakdown.vocabulary || 0 },
        { name: 'listening', score: skillBreakdown.listening || 0 },
        { name: 'speaking', score: skillBreakdown.speaking || 0 },
        { name: 'reading', score: skillBreakdown.reading || 0 },
        { name: 'writing', score: skillBreakdown.writing || 0 },
      ];
      const lowestSkill = skills.reduce((min, skill) =>
        skill.score < min.score ? skill : min,
      );
      weakAreas.push(lowestSkill.name);
    }

    return weakAreas;
  }

  /**
   * Find relevant courses matching weak areas
   */
  private async findRelevantCourses(
    weakAreas: string[],
    level: DifficultyLevel,
  ): Promise<Course[]> {
    const courses = await this.prisma.course.findMany({
      where: {
        difficulty: level,
        isPublished: true,
      },
      include: {
        lessons: {
          include: {
            activities: {
              select: {
                type: true,
              },
            },
          },
        },
      },
      take: 20,
    });

    // Score courses by weak area match
    const scored = courses.map((course) => {
      const activities = course.lessons.flatMap((l) => l.activities);
      const total = activities.length;
      if (total === 0) return { course, score: 0 };

      const activityCounts = {
        grammar: 0,
        vocabulary: 0,
        listening: 0,
        speaking: 0,
        reading: 0,
        writing: 0,
      };

      activities.forEach((activity) => {
        const type = activity.type?.toLowerCase() || '';
        if (type.includes('grammar')) activityCounts.grammar++;
        else if (type.includes('vocab')) activityCounts.vocabulary++;
        else if (type.includes('listen')) activityCounts.listening++;
        else if (type.includes('speak')) activityCounts.speaking++;
        else if (type.includes('read')) activityCounts.reading++;
        else if (type.includes('write')) activityCounts.writing++;
      });

      let matchScore = 0;
      weakAreas.forEach((area) => {
        const count = activityCounts[area as keyof typeof activityCounts] || 0;
        const percentage = (count / total) * 100;
        matchScore += percentage;
      });

      return { course, score: matchScore / weakAreas.length };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored
      .filter((c) => c.score > 10)
      .slice(0, 10)
      .map((c) => c.course);
  }

  /**
   * Find relevant lessons from enrolled courses
   */
  private async findRelevantLessons(
    userId: string,
    weakAreas: string[],
    level: DifficultyLevel,
  ): Promise<Lesson[]> {
    // Get enrolled classrooms
    const enrollments = await this.prisma.classroomStudent.findMany({
      where: {
        studentId: userId,
        isActive: true,
        isPurchased: true,
      },
      include: {
        classroom: {
          include: {
            course: {
              include: {
                lessons: {
                  include: {
                    activities: {
                      select: {
                        type: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const allLessons: Lesson[] = [];
    enrollments.forEach((enrollment) => {
      if (enrollment.classroom.course) {
        allLessons.push(...enrollment.classroom.course.lessons);
      }
    });

    // Score lessons by weak area match
    const scored = allLessons.map((lesson) => {
      const activities = lesson.activities || [];
      const total = activities.length;
      if (total === 0) return { lesson, score: 0 };

      const activityCounts = {
        grammar: 0,
        vocabulary: 0,
        listening: 0,
        speaking: 0,
        reading: 0,
        writing: 0,
      };

      activities.forEach((activity) => {
        const type = activity.type?.toLowerCase() || '';
        if (type.includes('grammar')) activityCounts.grammar++;
        else if (type.includes('vocab')) activityCounts.vocabulary++;
        else if (type.includes('listen')) activityCounts.listening++;
        else if (type.includes('speak')) activityCounts.speaking++;
        else if (type.includes('read')) activityCounts.reading++;
        else if (type.includes('write')) activityCounts.writing++;
      });

      let matchScore = 0;
      weakAreas.forEach((area) => {
        const count = activityCounts[area as keyof typeof activityCounts] || 0;
        const percentage = (count / total) * 100;
        matchScore += percentage;
      });

      return { lesson, score: matchScore / weakAreas.length };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored
      .filter((l) => l.score > 10)
      .slice(0, 10)
      .map((l) => l.lesson);
  }

  /**
   * Calculate confidence score for course
   */
  private calculateCourseConfidence(course: Course, weakAreas: string[]): number {
    // Base confidence: 50
    let confidence = 50;

    // Add points for level match
    // Add points for weak area match (handled in findRelevantCourses)

    return Math.min(confidence, 100);
  }

  /**
   * Calculate confidence score for lesson
   */
  private calculateLessonConfidence(lesson: Lesson, weakAreas: string[]): number {
    // Base confidence: 60 (lessons are more specific)
    let confidence = 60;

    // Add points for weak area match (handled in findRelevantLessons)

    return Math.min(confidence, 100);
  }

  /**
   * Rank recommendations by confidence
   */
  private rankRecommendations(
    candidates: RecommendationCandidate[],
  ): RecommendationCandidate[] {
    // Remove duplicates
    const unique = new Map<string, RecommendationCandidate>();
    candidates.forEach((candidate) => {
      const key = `${candidate.type}-${candidate.courseId || candidate.lessonId || candidate.activityId || candidate.podcastId}`;
      if (!unique.has(key) || unique.get(key)!.confidence < candidate.confidence) {
        unique.set(key, candidate);
      }
    });

    // Sort by confidence
    return Array.from(unique.values()).sort((a, b) => b.confidence - a.confidence);
  }
}

