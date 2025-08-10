/*
  Warnings:

  - The `state` column on the `Progress` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[lessonId,orderNo]` on the table `Activity` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderNo]` on the table `Course` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[courseId,orderNo]` on the table `Lesson` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('active', 'inactive', 'banned', 'pending');

-- CreateEnum
CREATE TYPE "public"."AuthProvider" AS ENUM ('local', 'google', 'facebook', 'apple');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "public"."LanguageCode" AS ENUM ('en', 'vi', 'ko', 'jp', 'zh', 'fr');

-- CreateEnum
CREATE TYPE "public"."TimezoneCode" AS ENUM ('Asia_Ho_Chi_Minh', 'Asia_Tokyo', 'Asia_Seoul', 'America_New_York', 'Europe_London');

-- CreateEnum
CREATE TYPE "public"."ProgressState" AS ENUM ('not_started', 'in_progress', 'done');

-- AlterTable
ALTER TABLE "public"."Progress" DROP COLUMN "state",
ADD COLUMN     "state" "public"."ProgressState" NOT NULL DEFAULT 'not_started';

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "gender" "public"."Gender",
ADD COLUMN     "language" "public"."LanguageCode",
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "provider" "public"."AuthProvider" NOT NULL DEFAULT 'local',
ADD COLUMN     "providerId" TEXT,
ADD COLUMN     "timezone" "public"."TimezoneCode",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "username" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "public"."Status" NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "Activity_lessonId_orderNo_idx" ON "public"."Activity"("lessonId", "orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_lessonId_orderNo_key" ON "public"."Activity"("lessonId", "orderNo");

-- CreateIndex
CREATE INDEX "Course_orderNo_idx" ON "public"."Course"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "Course_orderNo_key" ON "public"."Course"("orderNo");

-- CreateIndex
CREATE INDEX "Lesson_courseId_orderNo_idx" ON "public"."Lesson"("courseId", "orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_courseId_orderNo_key" ON "public"."Lesson"("courseId", "orderNo");

-- CreateIndex
CREATE INDEX "Progress_userId_updatedAt_idx" ON "public"."Progress"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "public"."User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "public"."User"("status");

-- CreateIndex
CREATE INDEX "User_provider_providerId_idx" ON "public"."User"("provider", "providerId");

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "public"."User"("lastActiveAt");
