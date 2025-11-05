# Vocabulary Notification Integration Guide

## Tích Hợp Thông Báo vào Review Service

### 1. Update ReviewService

```typescript
// review.service.ts
import { NotificationService } from '../../notification/service/notification.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class ReviewService {
    constructor(
        private readonly repository: VocabularyRepository,
        private readonly srsService: SRSService,
        private readonly notificationService: NotificationService, // Thêm này
    ) { }

    async submitReview(
        userId: string,
        dto: SubmitReviewDto,
    ): Promise<SubmitReviewResponseDto> {
        const { reviews, listId, mode = ReviewMode.FLASHCARD, duration } = dto;

        let correct = 0;
        let wrong = 0;
        const needPractice: string[] = [];
        const mastered: string[] = [];

        // ... existing logic ...

        // ========== NOTIFICATION 1: Session Complete ==========
        const totalReviewed = correct + wrong;
        if (totalReviewed >= 10) {
            try {
                await this.notificationService.create({
                    userId,
                    type: NotificationType.achievement,
                    title: '✅ Hoàn thành session!',
                    body: `Bạn đã review ${totalReviewed} từ (${correct} đúng, ${wrong} sai)`,
                    metadata: JSON.stringify({
                        listId,
                        correct,
                        wrong,
                        mode,
                        duration
                    }),
                });
            } catch (error) {
                // Log but don't break the flow
                console.error('Failed to send session complete notification:', error);
            }
        }

        // ========== NOTIFICATION 2: Mastered Terms ==========
        if (mastered.length > 0) {
            try {
                await this.notificationService.create({
                    userId,
                    type: NotificationType.achievement,
                    title: '🎉 Chúc mừng!',
                    body: `Bạn đã master ${mastered.length} từ mới!`,
                    metadata: JSON.stringify({
                        listId,
                        masteredCount: mastered.length,
                        masteredTermIds: mastered
                    }),
                });
            } catch (error) {
                console.error('Failed to send mastered notification:', error);
            }
        }

        // ========== NOTIFICATION 3: Milestone Achievement ==========
        const totalMastered = await this.repository.countMasteredTerms(userId);
        const milestones = [10, 50, 100, 250, 500, 1000];

        if (milestones.includes(totalMastered)) {
            try {
                await this.notificationService.create({
                    userId,
                    type: NotificationType.achievement,
                    title: '🏆 Thành tựu mới!',
                    body: `Bạn đã master ${totalMastered} từ vựng!`,
                    metadata: JSON.stringify({
                        milestone: totalMastered,
                        type: 'vocabulary_milestone'
                    }),
                });
            } catch (error) {
                console.error('Failed to send milestone notification:', error);
            }
        }

        return {
            correct,
            wrong,
            nextReviewDate: new Date(),
            needPractice,
            mastered,
        };
    }

    async getStats(userId: string, listId?: string): Promise<ReviewStatsDto> {
        // ... existing logic to calculate stats ...

        const reviewSessions = await this.repository.findUserReviewSessions(userId, {
            listId,
            limit: 365,
        });
        const reviewDates = reviewSessions.map((session) => session.createdAt);
        const { currentStreak, longestStreak } = this.srsService.calculateStreak(reviewDates);

        // ========== NOTIFICATION 4: Streak Milestone ==========
        // Gửi khi đạt streak 7, 14, 21, 30, 60, 90, 100+ ngày
        const streakMilestones = [7, 14, 21, 30, 60, 90, 100];
        if (streakMilestones.includes(currentStreak)) {
            try {
                await this.notificationService.create({
                    userId,
                    type: NotificationType.achievement,
                    title: `🔥 Streak ${currentStreak} ngày!`,
                    body: 'Bạn đang làm rất tốt! Hãy tiếp tục duy trì!',
                    metadata: JSON.stringify({
                        currentStreak,
                        longestStreak,
                        type: 'streak_milestone'
                    }),
                });
            } catch (error) {
                console.error('Failed to send streak notification:', error);
            }
        }

        return {
            totalTerms,
            newCount,
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
}
```

### 2. Add Repository Method

```typescript
// vocabulary.repository.ts

/**
 * Count total mastered terms for a user
 */
async countMasteredTerms(userId: string): Promise<number> {
    return this.prisma.userVocabularyProgress.count({
        where: {
            userId,
            status: 'mastered',
        },
    });
}
```

### 3. Update Module

```typescript
// vocabulary-v2.module.ts
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [NotificationModule], // Import để inject NotificationService
    providers: [
        VocabularyRepository,
        SRSService,
        VocabularyListService,
        VocabularyUnitService,
        VocabularyTermService,
        ReviewService,
    ],
    controllers: [
        VocabularyListController,
        VocabularyUnitController,
        VocabularyReviewController,
        AdminVocabularyController,
    ],
    exports: [
        VocabularyRepository,
        SRSService,
        VocabularyListService,
        VocabularyUnitService,
        VocabularyTermService,
        ReviewService,
    ],
})
export class VocabularyV2Module {}
```

---

## 🔔 Notification Types

| Trigger | Type | Title | Body | When |
|---------|------|-------|------|------|
| Session Complete | `achievement` | ✅ Hoàn thành session! | Bạn đã review X từ | Sau khi review ≥10 từ |
| Mastered Terms | `achievement` | 🎉 Chúc mừng! | Bạn đã master X từ mới! | Khi có từ được master |
| Milestone | `achievement` | 🏆 Thành tựu mới! | Bạn đã master X từ vựng! | 10, 50, 100, 250, 500, 1000 từ |
| Streak | `achievement` | 🔥 Streak X ngày! | Bạn đang làm rất tốt! | 7, 14, 21, 30, 60, 90, 100 ngày |
| Daily Reminder | `reminder` | 📚 Nhắc nhở ôn tập | Bạn có X từ cần ôn hôm nay | Hằng ngày (scheduled job) |

---

## 📋 Frontend Display

Thông báo sẽ hiện trên:
- 🔔 Notification bell (header)
- 📱 In-app notification center
- 📧 Email (optional, nếu user enable)

---

## ⚙️ Configuration

Có thể thêm settings cho user:
- Enable/disable vocabulary notifications
- Notification frequency (immediate, daily digest)
- Notification channels (in-app, email, push)

---

## 🚀 Scheduled Job (Optional)

Tạo job chạy hằng ngày để gửi reminder:

```typescript
// vocabulary-reminder.job.ts
@Injectable()
export class VocabularyReminderJob {
    constructor(
        private readonly reviewService: ReviewService,
        private readonly notificationService: NotificationService,
        private readonly prisma: PrismaRepository,
    ) {}

    @Cron('0 9 * * *') // 9AM every day
    async sendDailyReminders() {
        // Get all users with due cards
        const usersWithProgress = await this.prisma.userVocabularyProgress.groupBy({
            by: ['userId'],
            where: {
                nextReviewAt: {
                    lte: new Date(), // Due today or overdue
                },
            },
            _count: {
                id: true,
            },
        });

        for (const { userId, _count } of usersWithProgress) {
            if (_count.id > 0) {
                await this.notificationService.create({
                    userId,
                    type: NotificationType.reminder,
                    title: '📚 Nhắc nhở ôn tập',
                    body: `Bạn có ${_count.id} từ cần ôn hôm nay`,
                    metadata: JSON.stringify({ dueCount: _count.id }),
                });
            }
        }
    }
}
```

---

## ✅ Checklist

- [ ] Add `NotificationService` to `ReviewService` constructor
- [ ] Import `NotificationModule` in `VocabularyV2Module`
- [ ] Add `countMasteredTerms()` to `VocabularyRepository`
- [ ] Wrap notification calls in try-catch (don't break review flow)
- [ ] Test all notification triggers
- [ ] (Optional) Create scheduled job for daily reminders
- [ ] (Optional) Add user notification preferences

---

## 🎯 Benefits

1. **Tăng engagement**: User được nhắc nhở ôn tập
2. **Gamification**: Milestone và streak tạo động lực
3. **Celebrate success**: Chúc mừng khi đạt thành tích
4. **Better retention**: Reminder giúp user quay lại app

