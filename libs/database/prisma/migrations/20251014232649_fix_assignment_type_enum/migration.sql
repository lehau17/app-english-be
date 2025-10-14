-- AlterEnum: Update AssignmentType enum
ALTER TYPE "AssignmentType" RENAME VALUE 'EXAM' TO 'MIDTERM_EXAM';
ALTER TYPE "AssignmentType" ADD VALUE 'FINAL_EXAM';
-- Note: Cannot drop enum values in PostgreSQL, keeping PROJECT and PRACTICE for now

-- AlterTable: Update Assignment weight column
ALTER TABLE "public"."Assignment" ALTER COLUMN "weight" DROP NOT NULL;
ALTER TABLE "public"."Assignment" ALTER COLUMN "weight" SET DEFAULT 0;
ALTER TABLE "public"."Assignment" ALTER COLUMN "weight" TYPE DECIMAL(10,2);
