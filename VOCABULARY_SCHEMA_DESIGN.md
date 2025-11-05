# Vocabulary System - Database Schema Design

## Mô hình Parroto: List → Unit → Term

## 1. VocabularyList (Danh sách từ vựng)

```prisma
model VocabularyList {
  id          String   @id @default(uuid())
  title       String
  description String?

  // Metadata
  difficulty  DifficultyLevel @default(beginner)
  category    String?         // IELTS, TOEIC, Business, Travel...
  language    LanguageCode    @default(en)
  level       String?         // A1, A2, B1, B2, C1, C2

  // Images
  thumbnailUrl String?
  bannerUrl    String?

  // Publishing
  isPublic    Boolean  @default(true)
  isOfficial  Boolean  @default(false)  // Admin-created lists
  createdBy   String?

  // Stats
  totalTerms  Int      @default(0)      // Cached count
  totalUnits  Int      @default(0)      // Cached count
  userCount   Int      @default(0)      // How many users added this list

  // Order
  orderIndex  Int      @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  creator     User?              @relation("VocabularyListCreator", fields: [createdBy], references: [id], onDelete: SetNull)
  units       VocabularyUnit[]
  userLists   UserVocabularyList[]

  @@index([isPublic, isOfficial])
  @@index([category, difficulty])
  @@index([createdBy])
  @@map("vocabulary_lists")
}
```

## 2. VocabularyUnit (Unit trong danh sách)

```prisma
model VocabularyUnit {
  id          String   @id @default(uuid())
  listId      String

  title       String              // "Unit 1: Travel & Tourism"
  description String?

  // Order in list
  orderIndex  Int      @default(0)

  // Stats
  termCount   Int      @default(0)  // Cached count

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  list        VocabularyList    @relation(fields: [listId], references: [id], onDelete: Cascade)
  terms       VocabularyTerm[]

  @@unique([listId, orderIndex])
  @@index([listId])
  @@map("vocabulary_units")
}
```

## 3. VocabularyTerm (Từ vựng)

```prisma
model VocabularyTerm {
  id           String   @id @default(uuid())
  unitId       String

  // Word data
  word         String
  definition   String   @db.Text
  pronunciation String?
  partOfSpeech String?  // noun, verb, adjective...

  // Media
  audioUrl     String?
  imageUrl     String?

  // Examples (JSON array)
  examples     Json?    // [{ sentence: "...", translation: "..." }]

  // Related words (JSON)
  synonyms     String[]
  antonyms     String[]

  // IPA phonetic
  ipaUs        String?
  ipaUk        String?

  // Vietnamese translation
  translationVi String?

  // Order in unit
  orderIndex   Int      @default(0)

  // Difficulty
  difficulty   DifficultyLevel @default(beginner)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  unit         VocabularyUnit      @relation(fields: [unitId], references: [id], onDelete: Cascade)
  userProgress UserVocabularyProgress[]

  @@unique([unitId, orderIndex])
  @@index([unitId])
  @@index([word])
  @@map("vocabulary_terms")
}
```

## 4. UserVocabularyList (User đã thêm List nào)

```prisma
model UserVocabularyList {
  userId      String
  listId      String

  // Progress
  completedTerms Int      @default(0)
  totalTerms     Int      @default(0)

  // Tracking
  lastStudiedAt  DateTime?
  addedAt        DateTime @default(now())

  // Relations
  user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  list           VocabularyList @relation(fields: [listId], references: [id], onDelete: Cascade)

  @@id([userId, listId])
  @@index([userId])
  @@index([listId])
  @@map("user_vocabulary_lists")
}
```

## 5. UserVocabularyProgress (SRS Tracking cho từng term)

```prisma
model UserVocabularyProgress {
  userId       String
  termId       String

  // SRS Algorithm (SM-2)
  easeFactor   Float    @default(2.5)   // 1.3 - 2.5+
  interval     Int      @default(1)     // days
  repetitions  Int      @default(0)     // số lần ôn đúng liên tiếp

  // Stats
  correctCount Int      @default(0)
  wrongCount   Int      @default(0)

  // Status
  status       String   @default("new") // new, learning, review, mastered

  // Timestamps
  lastReviewAt DateTime @default(now())
  nextReviewAt DateTime             // Khi nào cần ôn lại

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  term         VocabularyTerm  @relation(fields: [termId], references: [id], onDelete: Cascade)

  @@id([userId, termId])
  @@index([userId, nextReviewAt])  // Query review queue
  @@index([userId, status])
  @@map("user_vocabulary_progress")
}
```

## 6. VocabularyReviewSession (Tracking mỗi lần ôn tập)

```prisma
model VocabularyReviewSession {
  id            String   @id @default(uuid())
  userId        String
  listId        String?

  // Stats
  totalCards    Int
  correctCount  Int
  wrongCount    Int
  duration      Int?     // seconds

  // Type
  mode          String   // flashcard, quiz, typing

  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
  @@map("vocabulary_review_sessions")
}
```

---

## Spaced Repetition Algorithm (SM-2)

### Formula:
```typescript
// Khi user trả lời đúng/sai, update:
if (quality >= 3) { // correct
  if (repetitions === 0) {
    interval = 1
  } else if (repetitions === 1) {
    interval = 6
  } else {
    interval = Math.round(interval * easeFactor)
  }
  repetitions += 1
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
} else { // wrong
  repetitions = 0
  interval = 1
}

nextReviewAt = now + interval (days)
```

### Quality scale:
- 5: Perfect (hoàn hảo)
- 4: Correct with hesitation (đúng nhưng chần chừ)
- 3: Correct with difficulty (đúng nhưng khó)
- 2: Wrong but remembered (sai nhưng có nhớ)
- 1: Wrong, not remembered (sai hoàn toàn)
- 0: Complete blackout (không nhớ gì)

---

## Relations với User model

Thêm vào User model:
```prisma
model User {
  // ... existing fields

  // Vocabulary relations
  createdLists      VocabularyList[]         @relation("VocabularyListCreator")
  addedLists        UserVocabularyList[]
  vocabularyProgress UserVocabularyProgress[]
  reviewSessions    VocabularyReviewSession[]
}
```

---

## Indexes for Performance

```prisma
// Queries phổ biến:
// 1. Lấy danh sách lists public/official
@@index([isPublic, isOfficial])
@@index([category, difficulty])

// 2. Lấy units theo listId (ordered)
@@index([listId, orderIndex])

// 3. Lấy terms theo unitId (ordered)
@@index([unitId, orderIndex])

// 4. Lấy từ cần review của user
@@index([userId, nextReviewAt])
@@index([userId, status])

// 5. User's vocabulary lists
@@index([userId])
@@index([listId])
```

---

## Migration Strategy

1. Keep `SavedWord` model (backward compatibility)
2. Add new models: VocabularyList, VocabularyUnit, VocabularyTerm, UserVocabularyProgress
3. Create migration script to convert existing data
4. Gradually deprecate SavedWord in favor of new system


