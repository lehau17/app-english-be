# Vocabulary Notification Integration - COMPLETE ✅

## Tổng Quan

Đã tích hợp thành công hệ thống **Notification** vào **Vocabulary Review Service**.
Notification sẽ tự động gửi qua **Kafka** → **background-worker** để xử lý async.

---

## 🔔 Các Loại Notification Đã Implement

### 1. **Session Complete** ✅
- **Trigger**: Sau khi user review xong ≥ 10 từ vựng
- **Type**: `achievement`
- **Title**: `✅ Hoàn thành session!`
- **Body**: `Bạn đã review X từ vựng (Y đúng, Z sai)`
- **Metadata**:
  ```json
  {
    "listId": "xxx",
    "correct": 15,
    "wrong": 5,
    "mode": "flashcard",
    "duration": 300,
    "type": "vocabulary_session_complete"
  }
  ```

### 2. **Mastered Terms** 🎉
- **Trigger**: Khi có từ đạt trạng thái "mastered" trong session
- **Type**: `achievement`
- **Title**: `🎉 Chúc mừng!`
- **Body**: `Bạn đã master X từ vựng mới!`
- **Metadata**:
  ```json
  {
    "listId": "xxx",
    "masteredCount": 3,
    "masteredTermIds": ["id1", "id2", "id3"],
    "type": "vocabulary_mastered"
  }
  ```

### 3. **Milestone Achievement** 🏆
- **Trigger**: Khi đạt mốc tổng số từ master: **10, 50, 100, 250, 500, 1000**
- **Type**: `achievement`
- **Title**: `🏆 Thành tựu mới!`
- **Body**: `Bạn đã master X từ vựng! Tuyệt vời!`
- **Metadata**:
  ```json
  {
    "milestone": 100,
    "type": "vocabulary_milestone"
  }
  ```

### 4. **Streak Milestone** 🔥
- **Trigger**: Khi đạt streak: **7, 14, 21, 30, 60, 90, 100 ngày**
- **Type**: `achievement`
- **Title**: `🔥 Streak X ngày!`
- **Body**: `Bạn đang làm rất tốt! Hãy tiếp tục duy trì học tập mỗi ngày!`
- **Metadata**:
  ```json
  {
    "currentStreak": 30,
    "longestStreak": 45,
    "type": "vocabulary_streak_milestone"
  }
  ```

---

## 📂 Files Đã Thay Đổi

### 1. **VocabularyRepository** (`repository/vocabulary.repository.ts`)
```typescript
// Thêm method mới
async countMasteredTerms(userId: string): Promise<number>
```
- Count tổng số từ đã master của user
- Dùng để check milestone

### 2. **ReviewService** (`service/review.service.ts`)
```typescript
// Inject NotificationService
constructor(
    private readonly repository: VocabularyRepository,
    private readonly srsService: SRSService,
    private readonly notificationService: NotificationService, // NEW
) {}
```

**Added Notifications:**
- `submitReview()`: Gửi 3 loại notification (Session Complete, Mastered Terms, Milestone)
- `getStats()`: Gửi Streak Milestone notification

**Error Handling:**
- Tất cả notification calls wrapped trong `try-catch`
- Không break review flow nếu notification fail
- Log errors với `Logger`

### 3. **VocabularyV2Module** (`vocabulary-v2.module.ts`)
```typescript
@Module({
    imports: [NotificationModule], // NEW - Import để inject NotificationService
    // ...
})
```

---

## 🔄 Flow Diagram

```
User Submit Review
       ↓
ReviewService.submitReview()
       ↓
1. Process reviews (SRS algorithm)
2. Update database
3. Create review session
       ↓
SEND NOTIFICATIONS (async)
       ↓
NotificationService.create()
       ↓
Save to DB + Send to Kafka
       ↓
background-worker processes
       ↓
User sees notification in app 🔔
```

---

## ✅ Notification Flow Details

### How it works:

1. **ReviewService** calls `notificationService.create()`
2. **NotificationService** saves to database
3. **NotificationService** sends to Kafka topic: `notifications`
4. **background-worker** consumes from Kafka
5. **background-worker** processes notification (in-app, email, push, etc.)
6. User sees notification in frontend

### Kafka Topic:
- **Topic**: `notifications`
- **Producer**: `NotificationService` (via `kafkaService.send()`)
- **Consumer**: `background-worker` app

---

## 🎯 Benefits

### 1. **Gamification**
- Milestone và streak tạo động lực học tập
- Chúc mừng khi đạt thành tích

### 2. **User Engagement**
- Nhắc nhở user quay lại app
- Celebrate success moments

### 3. **Progress Tracking**
- User biết được tiến độ của mình
- Clear feedback sau mỗi session

### 4. **Async Processing**
- Không block review flow
- Notification processed in background
- Scalable architecture

---

## 📊 Notification Statistics

| Event | Frequency | Type |
|-------|-----------|------|
| Session Complete | Per session (≥10 terms) | `achievement` |
| Mastered Terms | Per session (if any) | `achievement` |
| Milestone | 6 milestones (10→1000) | `achievement` |
| Streak | 7 milestones (7→100 days) | `achievement` |

**Estimated notifications per user per day:** 1-3 notifications

---

## 🧪 Testing

### Manual Test Scenarios

#### 1. Test Session Complete
```bash
# Review 10+ terms
POST /private/v1/vocabulary/review/submit
{
  "reviews": [
    { "termId": "xxx", "quality": 4 },
    { "termId": "yyy", "quality": 5 },
    // ... 10+ terms
  ],
  "listId": "xxx",
  "mode": "flashcard"
}

# Expected: ✅ Hoàn thành session! notification
```

#### 2. Test Mastered Terms
```bash
# Review terms with high quality (5) multiple times
# Until they reach "mastered" status

# Expected: 🎉 Chúc mừng! notification
```

#### 3. Test Milestone
```bash
# Review until total mastered = 10, 50, 100, etc.

# Expected: 🏆 Thành tựu mới! notification
```

#### 4. Test Streak
```bash
# Review every day for 7, 14, 21, 30 days
GET /private/v1/vocabulary/review/stats

# Expected: 🔥 Streak X ngày! notification
```

### Check Logs

```bash
# Backend logs
tail -f logs/client-api.log | grep "notification"

# Should see:
# [ReviewService] Sent session complete notification to user xxx
# [ReviewService] Sent mastered notification to user xxx (3 terms)
# [ReviewService] Sent milestone notification to user xxx (100 terms)
# [ReviewService] Sent streak notification to user xxx (30 days)
```

### Check Database

```sql
-- Check notifications table
SELECT * FROM "Notification"
WHERE "userId" = 'user-id'
ORDER BY "createdAt" DESC
LIMIT 10;

-- Check notification metadata
SELECT
  title,
  body,
  type,
  metadata::json->>'type' as notification_type,
  "createdAt"
FROM "Notification"
WHERE "userId" = 'user-id'
  AND metadata::json->>'type' LIKE 'vocabulary_%'
ORDER BY "createdAt" DESC;
```

---

## 🚀 Future Enhancements (Optional)

### 1. Daily Reminder (Scheduled Job)
```typescript
// vocabulary-reminder.job.ts
@Cron('0 9 * * *') // 9AM every day
async sendDailyReminders() {
  // Find users with due cards
  // Send reminder notifications
}
```

### 2. User Notification Preferences
```typescript
// Allow users to configure:
- Enable/disable vocabulary notifications
- Set reminder time
- Choose notification channels (in-app, email, push)
```

### 3. Smart Notifications
```typescript
// AI-powered suggestions:
- "You're close to milestone! Review 5 more terms"
- "Your streak is at risk! Review today"
- "Best time to review: afternoon (based on your history)"
```

### 4. Social Notifications
```typescript
// Friend activities:
- "Your friend mastered 100 words!"
- "Challenge your friend to a vocabulary duel"
```

---

## 🔧 Troubleshooting

### Notification not sent?

1. **Check logs**:
   ```bash
   grep "Failed to send" logs/client-api.log
   ```

2. **Check Kafka**:
   ```bash
   # Verify Kafka is running
   docker ps | grep redpanda

   # Check topic
   docker exec -it redpanda rpk topic consume notifications
   ```

3. **Check NotificationService**:
   ```bash
   # Verify NotificationModule is imported
   # Verify NotificationService is injectable
   ```

4. **Check background-worker**:
   ```bash
   # Verify background-worker is consuming from Kafka
   docker logs background-worker
   ```

---

## ✅ Checklist

Implementation Complete:

- [x] Add `countMasteredTerms()` to `VocabularyRepository`
- [x] Inject `NotificationService` into `ReviewService`
- [x] Import `NotificationModule` in `VocabularyV2Module`
- [x] Implement Session Complete notification
- [x] Implement Mastered Terms notification
- [x] Implement Milestone Achievement notification
- [x] Implement Streak Milestone notification
- [x] Wrap all notification calls in try-catch
- [x] Add logger for debugging
- [x] Build successfully

Ready to Deploy:

- [x] Backend code complete
- [x] No breaking changes
- [x] Async processing (Kafka)
- [x] Error handling in place
- [ ] Manual testing (pending)
- [ ] Monitor logs in production

---

## 📝 Summary

✅ **4 types of notifications** đã được tích hợp vào Vocabulary Review System:
1. Session Complete (≥10 terms)
2. Mastered Terms (per session)
3. Milestone Achievement (10, 50, 100, 250, 500, 1000)
4. Streak Milestone (7, 14, 21, 30, 60, 90, 100 days)

✅ **Async processing** qua Kafka → background-worker

✅ **Error handling** không break review flow

✅ **Logging** để monitor & debug

🚀 **Ready for testing & deployment!**

