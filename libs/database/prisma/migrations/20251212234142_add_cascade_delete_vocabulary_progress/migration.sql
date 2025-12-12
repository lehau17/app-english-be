-- AlterTable: Add CASCADE DELETE to user_vocabulary_progress foreign key
-- This prevents orphaned progress records when vocabulary terms are deleted

-- Drop existing foreign key constraint
ALTER TABLE "user_vocabulary_progress"
  DROP CONSTRAINT IF EXISTS "user_vocabulary_progress_termId_fkey";

-- Add foreign key constraint with CASCADE DELETE
ALTER TABLE "user_vocabulary_progress"
  ADD CONSTRAINT "user_vocabulary_progress_termId_fkey"
    FOREIGN KEY ("termId")
    REFERENCES "vocabulary_terms"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
