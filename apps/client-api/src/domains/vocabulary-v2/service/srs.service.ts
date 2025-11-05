import { Injectable } from '@nestjs/common';
import { UserVocabularyProgress } from '@prisma/client';
import { addDays, addHours } from 'date-fns';

/**
 * SRS (Spaced Repetition System) Service
 * Implements SM-2 Algorithm for optimal review scheduling
 *
 * Quality scale:
 * - 5: Perfect (hoàn hảo)
 * - 4: Correct with hesitation (đúng nhưng chần chừ)
 * - 3: Correct with difficulty (đúng nhưng khó)
 * - 2: Wrong but remembered (sai nhưng có nhớ)
 * - 1: Wrong, not remembered (sai hoàn toàn)
 * - 0: Complete blackout (không nhớ gì)
 */
@Injectable()
export class SRSService {
    /**
     * Calculate next review schedule based on SM-2 algorithm
     * @param progress Current user progress
     * @param quality Rating 0-5
     * @returns Updated progress data
     */
    calculateNextReview(
        progress: Partial<UserVocabularyProgress> | null,
        quality: number,
    ): {
        easeFactor: number;
        interval: number;
        repetitions: number;
        nextReviewAt: Date;
        status: string;
        lastReviewAt: Date;
    } {
        // Initialize defaults for new cards
        let easeFactor = progress?.easeFactor ?? 2.5;
        let interval = progress?.interval ?? 1;
        let repetitions = progress?.repetitions ?? 0;

        const now = new Date();

        // SM-2 Algorithm
        if (quality >= 3) {
            // Correct answer
            if (repetitions === 0) {
                interval = 1; // 1 day
            } else if (repetitions === 1) {
                interval = 6; // 6 days
            } else {
                interval = Math.round(interval * easeFactor);
            }

            repetitions += 1;

            // Update ease factor
            easeFactor = Math.max(
                1.3,
                easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
            );

            // Determine status based on progress
            let status = 'learning';
            if (repetitions >= 5 && interval >= 21) {
                status = 'mastered'; // Mastered after 5+ correct reviews with 21+ day interval
            } else if (repetitions >= 2) {
                status = 'review'; // In review phase
            }

            return {
                easeFactor: Number(easeFactor.toFixed(2)),
                interval,
                repetitions,
                nextReviewAt: addDays(now, interval),
                status,
                lastReviewAt: now,
            };
        } else {
            // Wrong answer - reset but keep some ease factor reduction
            easeFactor = Math.max(1.3, easeFactor - 0.2);

            // For first wrong answer, review in 10 minutes
            // For subsequent wrong answers, review in 1 day
            const reviewDelay = repetitions === 0 ? addHours(now, 0.1667) : addDays(now, 1);

            return {
                easeFactor: Number(easeFactor.toFixed(2)),
                interval: 1,
                repetitions: 0, // Reset repetitions
                nextReviewAt: reviewDelay,
                status: 'learning',
                lastReviewAt: now,
            };
        }
    }

    /**
     * Get quality rating suggestion based on answer correctness
     * This is a helper for the frontend to suggest appropriate quality ratings
     */
    getSuggestedQuality(isCorrect: boolean, hesitation: 'none' | 'slight' | 'much'): number {
        if (!isCorrect) {
            return hesitation === 'none' ? 2 : hesitation === 'slight' ? 1 : 0;
        }

        // Correct answers
        if (hesitation === 'none') return 5; // Perfect
        if (hesitation === 'slight') return 4; // Correct with slight hesitation
        return 3; // Correct with difficulty
    }

    /**
     * Analyze user's overall progress and suggest study plan
     */
    analyzeProgress(progressData: {
        newCount: number;
        learningCount: number;
        reviewCount: number;
        masteredCount: number;
        dueToday: number;
    }): {
        recommendation: string;
        priority: 'new' | 'review' | 'balanced';
        suggestedDailyGoal: number;
    } {
        const { newCount, learningCount, reviewCount, dueToday } = progressData;

        // Priority logic
        let priority: 'new' | 'review' | 'balanced' = 'balanced';
        let recommendation = '';
        let suggestedDailyGoal = 20;

        if (dueToday > 50) {
            priority = 'review';
            recommendation = 'Bạn có nhiều từ cần ôn tập. Hãy tập trung vào việc ôn tập trước!';
            suggestedDailyGoal = Math.min(dueToday, 30);
        } else if (dueToday < 10 && newCount > 0) {
            priority = 'new';
            recommendation = 'Tuyệt! Bạn đã ôn tập xong. Hãy học thêm từ mới!';
            suggestedDailyGoal = 20;
        } else {
            priority = 'balanced';
            recommendation = 'Hãy cân bằng giữa học từ mới và ôn tập!';
            suggestedDailyGoal = Math.max(dueToday + 5, 15);
        }

        return {
            recommendation,
            priority,
            suggestedDailyGoal,
        };
    }

    /**
     * Calculate study streak (computed from review sessions, not stored in DB)
     */
    calculateStreak(reviewDates: Date[]): {
        currentStreak: number;
        longestStreak: number;
    } {
        if (reviewDates.length === 0) {
            return { currentStreak: 0, longestStreak: 0 };
        }

        // Sort dates in descending order
        const sortedDates = reviewDates
            .map((d) => new Date(d).setHours(0, 0, 0, 0))
            .sort((a, b) => b - a);

        const today = new Date().setHours(0, 0, 0, 0);
        const yesterday = new Date(today).setDate(new Date(today).getDate() - 1);

        // Calculate current streak
        let currentStreak = 0;
        const latestDate = sortedDates[0];

        if (latestDate === today || latestDate === yesterday) {
            currentStreak = 1;
            for (let i = 1; i < sortedDates.length; i++) {
                const diff = (sortedDates[i - 1] - sortedDates[i]) / (1000 * 60 * 60 * 24);
                if (diff === 1) {
                    currentStreak++;
                } else {
                    break;
                }
            }
        }

        // Calculate longest streak
        let longestStreak = 1;
        let tempStreak = 1;

        for (let i = 1; i < sortedDates.length; i++) {
            const diff = (sortedDates[i - 1] - sortedDates[i]) / (1000 * 60 * 60 * 24);
            if (diff === 1) {
                tempStreak++;
                longestStreak = Math.max(longestStreak, tempStreak);
            } else {
                tempStreak = 1;
            }
        }

        return {
            currentStreak,
            longestStreak: Math.max(longestStreak, currentStreak),
        };
    }

    /**
     * Get review forecast (how many cards due in upcoming days)
     */
    getReviewForecast(
        progressList: UserVocabularyProgress[],
        days: number = 7,
    ): Array<{ date: Date; dueCount: number }> {
        const forecast: Array<{ date: Date; dueCount: number }> = [];
        const today = new Date();

        for (let i = 0; i < days; i++) {
            const targetDate = addDays(today, i);
            targetDate.setHours(23, 59, 59, 999); // End of day

            const dueCount = progressList.filter(
                (p) => new Date(p.nextReviewAt) <= targetDate,
            ).length;

            forecast.push({
                date: targetDate,
                dueCount,
            });
        }

        return forecast;
    }
}

