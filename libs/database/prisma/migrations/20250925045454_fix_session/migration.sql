/*
  Warnings:

  - You are about to drop the column `homework` on the `ClassroomSession` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `ClassroomSession` table. All the data in the column will be lost.
  - You are about to drop the column `maxStudents` on the `ClassroomSession` table. All the data in the column will be lost.
  - You are about to drop the column `roomId` on the `ClassroomSession` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ClassroomSession" DROP CONSTRAINT "ClassroomSession_roomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- AlterTable
ALTER TABLE "public"."ClassroomSession" DROP COLUMN "homework",
DROP COLUMN "location",
DROP COLUMN "maxStudents",
DROP COLUMN "roomId";

-- AlterTable
ALTER TABLE "public"."PasswordResetToken" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "public"."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
