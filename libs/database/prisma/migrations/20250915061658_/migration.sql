/*
  Warnings:

  - The values [Quiz nhanh,Chính tả,Hiểu nghĩa,Phát âm,Từ vựng,Nói với AI,Luyện viết,Tóm tắt] on the enum `ListeningActivityType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `hints` on the `podcast_activities` table. All the data in the column will be lost.
  - You are about to drop the column `instructions` on the `podcast_activities` table. All the data in the column will be lost.
  - You are about to drop the column `isLocked` on the `podcast_activities` table. All the data in the column will be lost.
  - You are about to drop the column `isPremium` on the `podcast_activities` table. All the data in the column will be lost.
  - You are about to drop the column `maxAttempts` on the `podcast_activities` table. All the data in the column will be lost.
  - You are about to drop the column `passingScore` on the `podcast_activities` table. All the data in the column will be lost.
  - You are about to drop the column `unlockAfter` on the `podcast_activities` table. All the data in the column will be lost.
  - You are about to drop the column `feedback` on the `podcast_activity_attempts` table. All the data in the column will be lost.
  - You are about to drop the column `isCorrect` on the `podcast_activity_attempts` table. All the data in the column will be lost.
  - You are about to drop the column `isPassed` on the `podcast_activity_attempts` table. All the data in the column will be lost.
  - You are about to drop the column `maxScore` on the `podcast_activity_attempts` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `podcast_activity_attempts` table. All the data in the column will be lost.
  - You are about to drop the column `strengths` on the `podcast_activity_attempts` table. All the data in the column will be lost.
  - You are about to drop the column `suggestions` on the `podcast_activity_attempts` table. All the data in the column will be lost.
  - You are about to drop the column `weaknesses` on the `podcast_activity_attempts` table. All the data in the column will be lost.

*/
-- AlterEnump
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ActivityType" ADD VALUE 'fill_blank';
ALTER TYPE "public"."ActivityType" ADD VALUE 'dictation';
ALTER TYPE "public"."ActivityType" ADD VALUE 'matching';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ListeningActivityType_new" AS ENUM ('Điền vào chỗ trống');
ALTER TABLE "public"."podcast_activities" ALTER COLUMN "type" TYPE "public"."ListeningActivityType_new" USING ("type"::text::"public"."ListeningActivityType_new");
ALTER TYPE "public"."ListeningActivityType" RENAME TO "ListeningActivityType_old";
ALTER TYPE "public"."ListeningActivityType_new" RENAME TO "ListeningActivityType";
DROP TYPE "public"."ListeningActivityType_old";
COMMIT;

-- DropIndex
DROP INDEX "public"."podcast_activities_podcastId_type_idx";

-- AlterTable
ALTER TABLE "public"."podcast_activities" DROP COLUMN "hints",
DROP COLUMN "instructions",
DROP COLUMN "isLocked",
DROP COLUMN "isPremium",
DROP COLUMN "maxAttempts",
DROP COLUMN "passingScore",
DROP COLUMN "unlockAfter",
ALTER COLUMN "type" SET DEFAULT 'Điền vào chỗ trống';

-- AlterTable
ALTER TABLE "public"."podcast_activity_attempts" DROP COLUMN "feedback",
DROP COLUMN "isCorrect",
DROP COLUMN "isPassed",
DROP COLUMN "maxScore",
DROP COLUMN "score",
DROP COLUMN "strengths",
DROP COLUMN "suggestions",
DROP COLUMN "weaknesses",
ADD COLUMN     "correctCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scorePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalQuestions" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "podcast_activities_podcastId_idx" ON "public"."podcast_activities"("podcastId");
