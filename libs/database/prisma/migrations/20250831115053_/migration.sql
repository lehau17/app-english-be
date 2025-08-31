/*
  Warnings:

  - The values [student,parent,teacher,admin,content_creator] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."UserRole_new" AS ENUM ('STUDENT', 'PARENT', 'TEACHER', 'ADMIN', 'CONTENT_CREATOR');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."User" ALTER COLUMN "role" TYPE "public"."UserRole_new" USING ("role"::text::"public"."UserRole_new");
ALTER TABLE "public"."Notification" ALTER COLUMN "targetRole" TYPE "public"."UserRole_new" USING ("targetRole"::text::"public"."UserRole_new");
ALTER TABLE "public"."FeatureFlag" ALTER COLUMN "userRoles" TYPE "public"."UserRole_new"[] USING ("userRoles"::text::"public"."UserRole_new"[]);
ALTER TYPE "public"."UserRole" RENAME TO "UserRole_old";
ALTER TYPE "public"."UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
COMMIT;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
