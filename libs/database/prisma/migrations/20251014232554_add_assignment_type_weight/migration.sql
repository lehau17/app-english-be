-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('HOMEWORK', 'QUIZ', 'EXAM', 'PROJECT', 'PRACTICE');

-- AlterTable
ALTER TABLE "public"."Assignment" ADD COLUMN "type" "AssignmentType" NOT NULL DEFAULT 'HOMEWORK';
ALTER TABLE "public"."Assignment" ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 1;
