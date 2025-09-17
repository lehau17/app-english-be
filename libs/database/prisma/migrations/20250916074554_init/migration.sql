/*
  Warnings:

  - You are about to drop the column `authorName` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `averageRating` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `difficultyRating` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `durationFormatted` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `fillBlankContent` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `isPremium` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `isRecommended` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `keywords` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `publishedAt` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `qualityRating` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `subtitle` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the column `totalRatings` on the `podcasts` table. All the data in the column will be lost.
  - You are about to drop the `user_podcast_progress` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `transcript` on table `podcasts` required. This step will fail if there are existing NULL values in that column.
  - Made the column `authorId` on table `podcasts` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."podcasts" DROP CONSTRAINT "podcasts_authorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_podcast_progress" DROP CONSTRAINT "user_podcast_progress_podcastId_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_podcast_progress" DROP CONSTRAINT "user_podcast_progress_userId_fkey";

-- DropIndex
DROP INDEX "public"."podcasts_category_idx";

-- DropIndex
DROP INDEX "public"."podcasts_code_idx";

-- DropIndex
DROP INDEX "public"."podcasts_difficulty_idx";

-- DropIndex
DROP INDEX "public"."podcasts_isRecommended_idx";

-- DropIndex
DROP INDEX "public"."podcasts_slug_key";

-- DropIndex
DROP INDEX "public"."podcasts_source_idx";

-- DropIndex
DROP INDEX "public"."podcasts_status_publishedAt_idx";

-- DropIndex
DROP INDEX "public"."podcasts_viewCount_idx";

-- AlterTable
ALTER TABLE "public"."podcasts" DROP COLUMN "authorName",
DROP COLUMN "averageRating",
DROP COLUMN "difficultyRating",
DROP COLUMN "durationFormatted",
DROP COLUMN "fillBlankContent",
DROP COLUMN "isPremium",
DROP COLUMN "isRecommended",
DROP COLUMN "keywords",
DROP COLUMN "publishedAt",
DROP COLUMN "qualityRating",
DROP COLUMN "slug",
DROP COLUMN "source",
DROP COLUMN "status",
DROP COLUMN "subtitle",
DROP COLUMN "tags",
DROP COLUMN "totalRatings",
ALTER COLUMN "transcript" SET NOT NULL,
ALTER COLUMN "authorId" SET NOT NULL;

-- DropTable
DROP TABLE "public"."user_podcast_progress";

-- CreateTable
CREATE TABLE "public"."podcast_gaps" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "startIndex" INTEGER NOT NULL,
    "endIndex" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "podcast_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "podcast_gaps_podcastId_idx" ON "public"."podcast_gaps"("podcastId");

-- AddForeignKey
ALTER TABLE "public"."podcasts" ADD CONSTRAINT "podcasts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."podcast_gaps" ADD CONSTRAINT "podcast_gaps_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "public"."podcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
