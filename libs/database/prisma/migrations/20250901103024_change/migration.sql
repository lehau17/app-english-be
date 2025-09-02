/*
  Warnings:

  - You are about to drop the column `schedule` on the `Classroom` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedTime` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the `Class` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ClassAttendance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ClassEnrollment` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `courseId` to the `Classroom` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodEnd` to the `Classroom` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodStart` to the `Classroom` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plannedHours` to the `Classroom` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sessionDurationHours` to the `Classroom` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."SessionStatus" AS ENUM ('scheduled', 'ongoing', 'completed', 'cancelled', 'postponed');

-- CreateEnum
CREATE TYPE "public"."SessionType" AS ENUM ('online', 'offline', 'hybrid');

-- CreateEnum
CREATE TYPE "public"."Weekday" AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');

-- DropForeignKey
ALTER TABLE "public"."Class" DROP CONSTRAINT "Class_courseId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Class" DROP CONSTRAINT "Class_instructorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Class" DROP CONSTRAINT "Class_roomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ClassAttendance" DROP CONSTRAINT "ClassAttendance_classId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ClassEnrollment" DROP CONSTRAINT "ClassEnrollment_classId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ClassEnrollment" DROP CONSTRAINT "ClassEnrollment_studentId_fkey";

-- AlterTable
ALTER TABLE "public"."Classroom" DROP COLUMN "schedule",
ADD COLUMN     "courseId" TEXT NOT NULL,
ADD COLUMN     "periodEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "periodStart" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "plannedHours" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "plannedSessions" INTEGER,
ADD COLUMN     "sessionDurationHours" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "timezone" "public"."TimezoneCode" NOT NULL DEFAULT 'Asia_Ho_Chi_Minh';

-- AlterTable
ALTER TABLE "public"."Course" DROP COLUMN "estimatedTime",
ADD COLUMN     "estimatedHours" DOUBLE PRECISION;

-- DropTable
DROP TABLE "public"."Class";

-- DropTable
DROP TABLE "public"."ClassAttendance";

-- DropTable
DROP TABLE "public"."ClassEnrollment";

-- CreateTable
CREATE TABLE "public"."ClassroomSlot" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "dayOfWeek" "public"."Weekday" NOT NULL,
    "startMinuteOfDay" INTEGER NOT NULL,
    "endMinuteOfDay" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sessionDurationHours" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassroomSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassroomSession" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" "public"."TimezoneCode" NOT NULL DEFAULT 'Asia_Ho_Chi_Minh',
    "durationHours" DOUBLE PRECISION NOT NULL,
    "type" "public"."SessionType" NOT NULL DEFAULT 'offline',
    "status" "public"."SessionStatus" NOT NULL DEFAULT 'scheduled',
    "maxStudents" INTEGER,
    "roomId" TEXT,
    "meetingUrl" TEXT,
    "location" TEXT,
    "agenda" JSONB,
    "materials" JSONB,
    "homework" JSONB,
    "notes" TEXT,
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassroomSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SessionAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassroomSlot_classroomId_idx" ON "public"."ClassroomSlot"("classroomId");

-- CreateIndex
CREATE INDEX "ClassroomSlot_dayOfWeek_idx" ON "public"."ClassroomSlot"("dayOfWeek");

-- CreateIndex
CREATE INDEX "ClassroomSession_classroomId_idx" ON "public"."ClassroomSession"("classroomId");

-- CreateIndex
CREATE INDEX "ClassroomSession_instructorId_idx" ON "public"."ClassroomSession"("instructorId");

-- CreateIndex
CREATE INDEX "ClassroomSession_startTime_idx" ON "public"."ClassroomSession"("startTime");

-- CreateIndex
CREATE INDEX "ClassroomSession_endTime_idx" ON "public"."ClassroomSession"("endTime");

-- CreateIndex
CREATE INDEX "SessionAttendance_sessionId_idx" ON "public"."SessionAttendance"("sessionId");

-- CreateIndex
CREATE INDEX "SessionAttendance_studentId_idx" ON "public"."SessionAttendance"("studentId");

-- CreateIndex
CREATE INDEX "SessionAttendance_status_idx" ON "public"."SessionAttendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAttendance_sessionId_studentId_key" ON "public"."SessionAttendance"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "Classroom_courseId_idx" ON "public"."Classroom"("courseId");

-- CreateIndex
CREATE INDEX "Classroom_periodStart_idx" ON "public"."Classroom"("periodStart");

-- CreateIndex
CREATE INDEX "Classroom_periodEnd_idx" ON "public"."Classroom"("periodEnd");

-- AddForeignKey
ALTER TABLE "public"."Classroom" ADD CONSTRAINT "Classroom_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomSlot" ADD CONSTRAINT "ClassroomSlot_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomSession" ADD CONSTRAINT "ClassroomSession_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomSession" ADD CONSTRAINT "ClassroomSession_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassroomSession" ADD CONSTRAINT "ClassroomSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionAttendance" ADD CONSTRAINT "SessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ClassroomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionAttendance" ADD CONSTRAINT "SessionAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
