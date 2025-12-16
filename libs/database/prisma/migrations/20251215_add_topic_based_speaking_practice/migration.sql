-- AlterTable: Add topic-based fields to speaking_practice_lessons
ALTER TABLE "speaking_practice_lessons" ADD COLUMN "category" TEXT DEFAULT 'General';
ALTER TABLE "speaking_practice_lessons" ADD COLUMN "difficultyTier" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex: Add indexes for topic-based queries
CREATE INDEX "speaking_practice_lessons_category_difficultyTier_idx" ON "speaking_practice_lessons"("category", "difficultyTier");
CREATE INDEX "speaking_practice_lessons_isActive_category_idx" ON "speaking_practice_lessons"("isActive", "category");

-- AlterTable: Add currentCategory to speaking_practice_progress
ALTER TABLE "speaking_practice_progress" ADD COLUMN "currentCategory" TEXT;

-- CreateTable: TopicProgress for per-user, per-category progress tracking
CREATE TABLE "topic_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "completedLessons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "easyCompleted" INTEGER NOT NULL DEFAULT 0,
    "mediumCompleted" INTEGER NOT NULL DEFAULT 0,
    "hardCompleted" INTEGER NOT NULL DEFAULT 0,
    "avgScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "weakPhonemesInTopic" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastPracticedAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint for userId + category
CREATE UNIQUE INDEX "topic_progress_userId_category_key" ON "topic_progress"("userId", "category");

-- CreateIndex: Index for topic progress queries
CREATE INDEX "topic_progress_userId_nextReviewDate_idx" ON "topic_progress"("userId", "nextReviewDate");
CREATE INDEX "topic_progress_category_idx" ON "topic_progress"("category");

-- AddForeignKey: Link TopicProgress to User
ALTER TABLE "topic_progress" ADD CONSTRAINT "topic_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
