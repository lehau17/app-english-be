/*
  Warnings:

  - The `hints` column on the `Activity` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `mediaUrls` column on the `Activity` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "public"."Question" DROP CONSTRAINT "Question_activityId_fkey";

-- AlterTable
ALTER TABLE "public"."Activity" DROP COLUMN "hints",
ADD COLUMN     "hints" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "mediaUrls",
ADD COLUMN     "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "public"."DailyQuest" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 10,
    "category" TEXT,
    "difficulty" "public"."DifficultyLevel" NOT NULL DEFAULT 'beginner',
    "targetValue" INTEGER,
    "targetType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDaily" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyQuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuestProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "progress" INTEGER,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "targetValue" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyQuest_isActive_idx" ON "public"."DailyQuest"("isActive");

-- CreateIndex
CREATE INDEX "DailyQuest_isDaily_idx" ON "public"."DailyQuest"("isDaily");

-- CreateIndex
CREATE INDEX "DailyQuest_category_idx" ON "public"."DailyQuest"("category");

-- CreateIndex
CREATE INDEX "DailyQuest_validFrom_validUntil_idx" ON "public"."DailyQuest"("validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "QuestProgress_userId_idx" ON "public"."QuestProgress"("userId");

-- CreateIndex
CREATE INDEX "QuestProgress_questId_idx" ON "public"."QuestProgress"("questId");

-- CreateIndex
CREATE INDEX "QuestProgress_done_idx" ON "public"."QuestProgress"("done");

-- CreateIndex
CREATE INDEX "QuestProgress_startedAt_idx" ON "public"."QuestProgress"("startedAt");

-- CreateIndex
CREATE INDEX "QuestProgress_completedAt_idx" ON "public"."QuestProgress"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestProgress_userId_questId_key" ON "public"."QuestProgress"("userId", "questId");

-- AddForeignKey
ALTER TABLE "public"."QuestProgress" ADD CONSTRAINT "QuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestProgress" ADD CONSTRAINT "QuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "public"."DailyQuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
