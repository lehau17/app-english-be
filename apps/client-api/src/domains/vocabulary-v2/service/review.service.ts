import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationService } from '../../notification/service/notification.service';
import {
    GetDueCardsQueryDto,
    ReviewMode,
    ReviewSessionResponseDto,
    ReviewStatsDto,
    StartReviewSessionDto,
    SubmitReviewDto,
    SubmitReviewResponseDto,
} from '../dto/review.dto';
import { VocabularyTermResponseDto } from '../dto/vocabulary-term.dto';
import { VocabularyRepository } from '../repository/vocabulary.repository';
import { SRSService } from './srs.service';

@Injectable()
export class ReviewService {
    private readonly logger = new Logger(ReviewService.name);

    constructor(
        private readonly repository: VocabularyRepository,
        private readonly srsService: SRSService,
        private readonly notificationService: NotificationService,
    ) { }

    /**
     * Start a review session
     * Returns terms to review (due cards + new cards)
     */
    async startSession(
        userId: string,
        dto: StartReviewSessionDto,
    ): Promise<ReviewSessionResponseDto> {
        const { listId, unitId, mode, limit = 20, includeNew = true, includeReview = true } = dto;

        let terms: VocabularyTermResponseDto[] = [];
        let dueCards = 0;
        let newCards = 0;

        // Get due cards (review)
        if (includeReview) {
            const due = await this.repository.findDueCards(userId, {
                listId,
                limit,
            });

            dueCards = due.length;

            terms.push(
                ...due.map((progress) => ({
                    id: progress.term.id,
                    unitId: progress.term.unitId,
                    word: progress.term.word,
                    definition: progress.term.definition,
                    pronunciation: progress.term.pronunciation || undefined,
                    partOfSpeech: progress.term.partOfSpeech || undefined,
                    audioUrl: progress.term.audioUrl || undefined,
                    imageUrl: progress.term.imageUrl || undefined,
                    examples: progress.term.examples || undefined,
                    synonyms: progress.term.synonyms,
                    antonyms: progress.term.antonyms,
                    ipaUs: progress.term.ipaUs || undefined,
                    ipaUk: progress.term.ipaUk || undefined,
                    translationVi: progress.term.translationVi || undefined,
                    orderIndex: progress.term.orderIndex,
                    difficulty: progress.term.difficulty as string,
                    createdAt: progress.term.createdAt,
                    updatedAt: progress.term.updatedAt,
                    userProgress: {
                        status: progress.status,
                        nextReviewAt: progress.nextReviewAt,
                        correctCount: progress.correctCount,
                        wrongCount: progress.wrongCount,
                        repetitions: progress.repetitions,
                        lastReviewAt: progress.lastReviewAt,
                    },
                })),
            );
        }

        // Get new cards if needed
        if (includeNew && terms.length < limit) {
            const remainingLimit = limit - terms.length;
            const newTerms = await this.repository.findNewCards(userId, {
                listId,
                unitId,
                limit: remainingLimit,
            });

            newCards = newTerms.length;

            terms.push(
                ...newTerms.map((term) => ({
                    id: term.id,
                    unitId: term.unitId,
                    word: term.word,
                    definition: term.definition,
                    pronunciation: term.pronunciation || undefined,
                    partOfSpeech: term.partOfSpeech || undefined,
                    audioUrl: term.audioUrl || undefined,
                    imageUrl: term.imageUrl || undefined,
                    examples: term.examples || undefined,
                    synonyms: term.synonyms,
                    antonyms: term.antonyms,
                    ipaUs: term.ipaUs || undefined,
                    ipaUk: term.ipaUk || undefined,
                    translationVi: term.translationVi || undefined,
                    orderIndex: term.orderIndex,
                    difficulty: term.difficulty as string,
                    createdAt: term.createdAt,
                    updatedAt: term.updatedAt,
                    userProgress: undefined, // New card - no progress yet
                })),
            );
        }

        return {
            terms,
            totalDue: dueCards,
            newCount: newCards,
            reviewCount: dueCards,
            mode,
        };
    }

    /**
     * Submit review results
     * Updates SRS progress for each term based on quality rating
     */
    async submitReview(
        userId: string,
        dto: SubmitReviewDto,
    ): Promise<SubmitReviewResponseDto> {
        const { reviews, listId, mode = ReviewMode.FLASHCARD, duration } = dto;

        let correct = 0;
        let wrong = 0;
        const needPractice: string[] = [];
        const mastered: string[] = [];

        // Process each review
        for (const review of reviews) {
            const { termId, quality } = review;

            // Get current progress
            const currentProgress = await this.repository.findProgress(userId, termId);

            // Calculate next review schedule using SRS algorithm
            const nextSchedule = this.srsService.calculateNextReview(currentProgress, quality);

            // Update or create progress
            await this.repository.upsertProgress(
                userId,
                termId,
                {
                    user: { connect: { id: userId } },
                    term: { connect: { id: termId } },
                    easeFactor: nextSchedule.easeFactor,
                    interval: nextSchedule.interval,
                    repetitions: nextSchedule.repetitions,
                    status: nextSchedule.status,
                    correctCount: quality >= 3 ? (currentProgress?.correctCount || 0) + 1 : currentProgress?.correctCount || 0,
                    wrongCount: quality < 3 ? (currentProgress?.wrongCount || 0) + 1 : currentProgress?.wrongCount || 0,
                    lastReviewAt: nextSchedule.lastReviewAt,
                    nextReviewAt: nextSchedule.nextReviewAt,
                },
                {
                    easeFactor: nextSchedule.easeFactor,
                    interval: nextSchedule.interval,
                    repetitions: nextSchedule.repetitions,
                    status: nextSchedule.status,
                    correctCount: quality >= 3 ? { increment: 1 } : undefined,
                    wrongCount: quality < 3 ? { increment: 1 } : undefined,
                    lastReviewAt: nextSchedule.lastReviewAt,
                    nextReviewAt: nextSchedule.nextReviewAt,
                },
            );

            // Track stats
            if (quality >= 3) {
                correct++;
                if (nextSchedule.status === 'mastered') {
                    mastered.push(termId);
                }
            } else {
                wrong++;
                needPractice.push(termId);
            }
        }

        // Create review session record
        if (listId) {
            await this.repository.createReviewSession({
                user: { connect: { id: userId } },
                listId,
                totalCards: reviews.length,
                correctCount: correct,
                wrongCount: wrong,
                duration,
                mode,
            });
        }

        // Update user list progress if listId provided
        if (listId) {
            const userList = await this.repository.findUserList(userId, listId);
            if (userList) {
                const stats = await this.repository.getUserListStats(userId, listId);
                const completedTerms = stats.masteredCount + stats.reviewCount;

                await this.repository.updateUserListProgress(userId, listId, {
                    completedTerms,
                    lastStudiedAt: new Date(),
                });
            }
        }

        // ========== SEND NOTIFICATIONS ==========

        // 1. Session Complete Notification (if reviewed >= 10 terms)
        const totalReviewed = correct + wrong;
        if (totalReviewed >= 10) {
            try {
                await this.notificationService.create({
                    userId,
                    type: NotificationType.achievement,
                    title: '✅ Hoàn thành session!',
                    body: `Bạn đã review ${totalReviewed} từ vựng (${correct} đúng, ${wrong} sai)`,
                    data: JSON.stringify({
                        listId,
                        correct,
                        wrong,
                        mode,
                        duration,
                        type: 'vocabulary_session_complete'
                    }),
                    channel: 'socket' as any,
                });
                this.logger.log(`Sent session complete notification to user ${userId}`);
            } catch (error) {
                this.logger.error('Failed to send session complete notification:', error);
            }
        }

        // 2. Mastered Terms Notification
        if (mastered.length > 0) {
            try {
                await this.notificationService.create({
                    userId,
                    type: NotificationType.achievement,
                    title: '🎉 Chúc mừng!',
                    body: `Bạn đã master ${mastered.length} từ vựng mới!`,
                    data: JSON.stringify({
                        listId,
                        masteredCount: mastered.length,
                        masteredTermIds: mastered,
                        type: 'vocabulary_mastered'
                    }),
                    channel: 'socket' as any,
                });
                this.logger.log(`Sent mastered notification to user ${userId} (${mastered.length} terms)`);
            } catch (error) {
                this.logger.error('Failed to send mastered notification:', error);
            }
        }

        // 3. Milestone Achievement Notification (10, 50, 100, 250, 500, 1000 terms)
        try {
            const totalMastered = await this.repository.countMasteredTerms(userId);
            const milestones = [10, 50, 100, 250, 500, 1000];

            if (milestones.includes(totalMastered)) {
                await this.notificationService.create({
                    userId,
                    type: NotificationType.achievement,
                    title: '🏆 Thành tựu mới!',
                    body: `Bạn đã master ${totalMastered} từ vựng! Tuyệt vời!`,
                    data: JSON.stringify({
                        milestone: totalMastered,
                        type: 'vocabulary_milestone'
                    }),
                    channel: 'socket' as any,
                });
                this.logger.log(`Sent milestone notification to user ${userId} (${totalMastered} terms)`);
            }
        } catch (error) {
            this.logger.error('Failed to send milestone notification:', error);
        }

        return {
            correct,
            wrong,
            nextReviewDate: new Date(), // Next session date (can be calculated based on due cards)
            needPractice,
            mastered,
        };
    }

    /**
     * Get review statistics for user
     */
    async getStats(userId: string, listId?: string): Promise<ReviewStatsDto> {
        // Get all terms count
        let totalTerms = 0;
        if (listId) {
            const { totalTerms: count } = await this.repository.getListStats(listId);
            totalTerms = count;
        }

        // Get user progress stats
        const progressList = await this.repository.findUserProgress(userId, { listId });

        const stats = {
            newCount: 0,
            learningCount: 0,
            reviewCount: 0,
            masteredCount: 0,
        };

        progressList.forEach((progress) => {
            if (progress.status === 'new') stats.newCount++;
            else if (progress.status === 'learning') stats.learningCount++;
            else if (progress.status === 'review') stats.reviewCount++;
            else if (progress.status === 'mastered') stats.masteredCount++;
        });

        // Calculate new terms (never studied)
        const studiedCount = progressList.length;
        const newTermsCount = totalTerms - studiedCount;

        // Get due today count
        const dueCards = await this.repository.findDueCards(userId, { listId, limit: 1000 });
        const dueToday = dueCards.length;

        // Calculate streaks (computed from review sessions, not stored in DB)
        const reviewSessions = await this.repository.findUserReviewSessions(userId, {
            listId,
            limit: 365, // Last year
        });
        const reviewDates = reviewSessions.map((session) => session.createdAt);
        const { currentStreak, longestStreak } = this.srsService.calculateStreak(reviewDates);

        // Get last studied date
        let lastStudiedAt: Date | undefined;
        if (listId) {
            const userList = await this.repository.findUserList(userId, listId);
            lastStudiedAt = userList?.lastStudiedAt || undefined;
        }

        // ========== STREAK NOTIFICATION ==========
        // Send notification for streak milestones: 7, 14, 21, 30, 60, 90, 100 days
        const streakMilestones = [7, 14, 21, 30, 60, 90, 100];
        if (streakMilestones.includes(currentStreak)) {
            try {
                await this.notificationService.create({
                    userId,
                    type: NotificationType.achievement,
                    title: `🔥 Streak ${currentStreak} ngày!`,
                    body: 'Bạn đang làm rất tốt! Hãy tiếp tục duy trì học tập mỗi ngày!',
                    data: JSON.stringify({
                        currentStreak,
                        longestStreak,
                        type: 'vocabulary_streak_milestone'
                    }),
                    channel: 'socket' as any,
                });
                this.logger.log(`Sent streak notification to user ${userId} (${currentStreak} days)`);
            } catch (error) {
                this.logger.error('Failed to send streak notification:', error);
            }
        }

        return {
            totalTerms,
            newCount: newTermsCount,
            learningCount: stats.learningCount,
            reviewCount: stats.reviewCount,
            masteredCount: stats.masteredCount,
            dueToday,
            currentStreak,
            longestStreak,
            totalReviews: reviewSessions.length,
            lastStudiedAt,
        };
    }

    /**
     * Get due cards
     */
    async getDueCards(userId: string, query: GetDueCardsQueryDto): Promise<VocabularyTermResponseDto[]> {
        const { listId, limit = 20 } = query;

        const dueCards = await this.repository.findDueCards(userId, {
            listId,
            limit,
        });

        return dueCards.map((progress) => ({
            id: progress.term.id,
            unitId: progress.term.unitId,
            word: progress.term.word,
            definition: progress.term.definition,
            pronunciation: progress.term.pronunciation || undefined,
            partOfSpeech: progress.term.partOfSpeech || undefined,
            audioUrl: progress.term.audioUrl || undefined,
            imageUrl: progress.term.imageUrl || undefined,
            examples: progress.term.examples || undefined,
            synonyms: progress.term.synonyms,
            antonyms: progress.term.antonyms,
            ipaUs: progress.term.ipaUs || undefined,
            ipaUk: progress.term.ipaUk || undefined,
            translationVi: progress.term.translationVi || undefined,
            orderIndex: progress.term.orderIndex,
            difficulty: progress.term.difficulty as string,
            createdAt: progress.term.createdAt,
            updatedAt: progress.term.updatedAt,
            userProgress: {
                status: progress.status,
                nextReviewAt: progress.nextReviewAt,
                correctCount: progress.correctCount,
                wrongCount: progress.wrongCount,
                repetitions: progress.repetitions,
                lastReviewAt: progress.lastReviewAt,
            },
        }));
    }
}

