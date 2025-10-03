/*
  Warnings:

  - You are about to drop the column `sessionId` on the `SessionActivity` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sessionScheduleId,orderNo]` on the table `SessionActivity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sessionScheduleId` to the `SessionActivity` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."SessionActivity" DROP CONSTRAINT "SessionActivity_sessionId_fkey";

-- DropIndex
DROP INDEX "public"."SessionActivity_sessionId_idx";

-- DropIndex
DROP INDEX "public"."SessionActivity_sessionId_orderNo_key";

-- AlterTable
ALTER TABLE "public"."SessionActivity" DROP COLUMN "sessionId",
ADD COLUMN     "sessionScheduleId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "SessionActivity_sessionScheduleId_idx" ON "public"."SessionActivity"("sessionScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionActivity_sessionScheduleId_orderNo_key" ON "public"."SessionActivity"("sessionScheduleId", "orderNo");

-- AddForeignKey
ALTER TABLE "public"."SessionActivity" ADD CONSTRAINT "SessionActivity_sessionScheduleId_fkey" FOREIGN KEY ("sessionScheduleId") REFERENCES "public"."SessionSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
