/*
  Warnings:

  - You are about to drop the `Badge` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DailyQuest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LeaderboardEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestProgress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserBadge` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserStats` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."LeaderboardEntry" DROP CONSTRAINT "LeaderboardEntry_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."QuestProgress" DROP CONSTRAINT "QuestProgress_questId_fkey";

-- DropForeignKey
ALTER TABLE "public"."QuestProgress" DROP CONSTRAINT "QuestProgress_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserBadge" DROP CONSTRAINT "UserBadge_badgeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserBadge" DROP CONSTRAINT "UserBadge_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserStats" DROP CONSTRAINT "UserStats_userId_fkey";

-- DropTable
DROP TABLE "public"."Badge";

-- DropTable
DROP TABLE "public"."DailyQuest";

-- DropTable
DROP TABLE "public"."LeaderboardEntry";

-- DropTable
DROP TABLE "public"."QuestProgress";

-- DropTable
DROP TABLE "public"."UserBadge";

-- DropTable
DROP TABLE "public"."UserStats";
