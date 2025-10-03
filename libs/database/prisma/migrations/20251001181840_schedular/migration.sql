/*
  Warnings:

  - The required column `conversationId` was added to the `ai_speaking_sessions` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "plannedSessions" INTEGER DEFAULT 8;

-- AlterTable
ALTER TABLE "public"."ai_speaking_sessions" ADD COLUMN     "conversationId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."SessionSchedule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SessionActivity" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL,

    CONSTRAINT "SessionActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionSchedule_courseId_idx" ON "public"."SessionSchedule"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionSchedule_courseId_sessionNumber_key" ON "public"."SessionSchedule"("courseId", "sessionNumber");

-- CreateIndex
CREATE INDEX "SessionActivity_sessionId_idx" ON "public"."SessionActivity"("sessionId");

-- CreateIndex
CREATE INDEX "SessionActivity_activityId_idx" ON "public"."SessionActivity"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionActivity_sessionId_orderNo_key" ON "public"."SessionActivity"("sessionId", "orderNo");

-- CreateIndex
CREATE INDEX "ai_speaking_sessions_userId_conversationId_idx" ON "public"."ai_speaking_sessions"("userId", "conversationId");

-- AddForeignKey
ALTER TABLE "public"."SessionSchedule" ADD CONSTRAINT "SessionSchedule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionActivity" ADD CONSTRAINT "SessionActivity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."SessionSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionActivity" ADD CONSTRAINT "SessionActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
