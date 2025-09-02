/*
  Warnings:

  - Added the required column `instructorId` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ClassStatus" AS ENUM ('scheduled', 'ongoing', 'completed', 'cancelled', 'postponed');

-- CreateEnum
CREATE TYPE "public"."ClassType" AS ENUM ('online', 'offline', 'hybrid');

-- CreateEnum
CREATE TYPE "public"."EnrollmentStatus" AS ENUM ('pending', 'active', 'completed', 'dropped', 'suspended');

-- DropIndex
DROP INDEX "public"."Course_orderNo_key";

-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "currency" TEXT DEFAULT 'VND',
ADD COLUMN     "instructorId" TEXT NOT NULL,
ADD COLUMN     "language" "public"."LanguageCode" NOT NULL DEFAULT 'vi',
ADD COLUMN     "maxStudents" INTEGER DEFAULT 20,
ADD COLUMN     "price" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "totalDuration" INTEGER DEFAULT 0,
ADD COLUMN     "totalLessons" INTEGER DEFAULT 0,
ALTER COLUMN "orderNo" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."CourseEnrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "public"."EnrollmentStatus" NOT NULL DEFAULT 'pending',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "droppedAt" TIMESTAMP(3),
    "amountPaid" DOUBLE PRECISION DEFAULT 0,
    "paymentId" TEXT,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMP(3),

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Class" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" "public"."TimezoneCode" NOT NULL DEFAULT 'Asia_Ho_Chi_Minh',
    "type" "public"."ClassType" NOT NULL DEFAULT 'online',
    "status" "public"."ClassStatus" NOT NULL DEFAULT 'scheduled',
    "maxStudents" INTEGER NOT NULL DEFAULT 20,
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

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassEnrollment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "public"."EnrollmentStatus" NOT NULL DEFAULT 'active',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "ClassEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassAttendance" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "description" TEXT,
    "equipment" JSONB,
    "facilities" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseEnrollment_studentId_idx" ON "public"."CourseEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "CourseEnrollment_status_idx" ON "public"."CourseEnrollment"("status");

-- CreateIndex
CREATE INDEX "CourseEnrollment_enrolledAt_idx" ON "public"."CourseEnrollment"("enrolledAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_courseId_studentId_key" ON "public"."CourseEnrollment"("courseId", "studentId");

-- CreateIndex
CREATE INDEX "Class_courseId_idx" ON "public"."Class"("courseId");

-- CreateIndex
CREATE INDEX "Class_instructorId_idx" ON "public"."Class"("instructorId");

-- CreateIndex
CREATE INDEX "Class_startTime_idx" ON "public"."Class"("startTime");

-- CreateIndex
CREATE INDEX "Class_endTime_idx" ON "public"."Class"("endTime");

-- CreateIndex
CREATE INDEX "Class_status_idx" ON "public"."Class"("status");

-- CreateIndex
CREATE INDEX "Class_type_idx" ON "public"."Class"("type");

-- CreateIndex
CREATE INDEX "ClassEnrollment_studentId_idx" ON "public"."ClassEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_status_idx" ON "public"."ClassEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassEnrollment_classId_studentId_key" ON "public"."ClassEnrollment"("classId", "studentId");

-- CreateIndex
CREATE INDEX "ClassAttendance_classId_idx" ON "public"."ClassAttendance"("classId");

-- CreateIndex
CREATE INDEX "ClassAttendance_studentId_idx" ON "public"."ClassAttendance"("studentId");

-- CreateIndex
CREATE INDEX "ClassAttendance_status_idx" ON "public"."ClassAttendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassAttendance_classId_studentId_key" ON "public"."ClassAttendance"("classId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "public"."Room"("code");

-- CreateIndex
CREATE INDEX "Room_code_idx" ON "public"."Room"("code");

-- CreateIndex
CREATE INDEX "Room_isActive_idx" ON "public"."Room"("isActive");

-- CreateIndex
CREATE INDEX "Course_instructorId_idx" ON "public"."Course"("instructorId");

-- CreateIndex
CREATE INDEX "Course_price_idx" ON "public"."Course"("price");

-- AddForeignKey
ALTER TABLE "public"."Course" ADD CONSTRAINT "Course_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Class" ADD CONSTRAINT "Class_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Class" ADD CONSTRAINT "Class_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Class" ADD CONSTRAINT "Class_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassAttendance" ADD CONSTRAINT "ClassAttendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
