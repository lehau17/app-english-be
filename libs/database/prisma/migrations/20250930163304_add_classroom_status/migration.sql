-- CreateEnum
CREATE TYPE "public"."ClassroomStatus" AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "public"."Classroom" ADD COLUMN     "status" "public"."ClassroomStatus" NOT NULL DEFAULT 'upcoming';

-- CreateIndex
CREATE INDEX "Classroom_status_idx" ON "public"."Classroom"("status");
