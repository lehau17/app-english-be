-- CreateEnum
CREATE TYPE "public"."AttemptStatus" AS ENUM ('in_progress', 'submitted', 'completed');

-- AlterTable
ALTER TABLE "public"."podcast_attempts" ADD COLUMN     "status" "public"."AttemptStatus" NOT NULL DEFAULT 'in_progress';
