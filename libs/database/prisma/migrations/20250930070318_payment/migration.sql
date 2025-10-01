-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('pending', 'success', 'failed', 'cancelled', 'refunded', 'expired');

-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('vnpay', 'momo', 'zalopay', 'stripe', 'paypal');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('course_purchase', 'lesson_unlock', 'refund', 'bonus');

-- AlterTable
ALTER TABLE "public"."ClassroomStudent" ADD COLUMN     "isPurchased" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "type" "public"."TransactionType" NOT NULL DEFAULT 'course_purchase',
    "provider" "public"."PaymentProvider" NOT NULL DEFAULT 'vnpay',
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'pending',
    "vnpayTransactionNo" TEXT,
    "vnpayTxnRef" TEXT,
    "vnpayResponseCode" TEXT,
    "vnpaySecureHash" TEXT,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT,
    "classroomId" TEXT,
    "description" TEXT,
    "returnUrl" TEXT,
    "ipAddress" TEXT,
    "responseData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transaction_studentId_idx" ON "public"."Transaction"("studentId");

-- CreateIndex
CREATE INDEX "Transaction_courseId_idx" ON "public"."Transaction"("courseId");

-- CreateIndex
CREATE INDEX "Transaction_classroomId_idx" ON "public"."Transaction"("classroomId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "public"."Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_vnpayTxnRef_idx" ON "public"."Transaction"("vnpayTxnRef");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "public"."Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "ClassroomStudent_isPurchased_idx" ON "public"."ClassroomStudent"("isPurchased");

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "public"."Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
