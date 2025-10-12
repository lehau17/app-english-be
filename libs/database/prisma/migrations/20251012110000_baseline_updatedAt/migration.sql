-- AlterTable: Add updatedAt to Attempt if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Attempt'
          AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "public"."Attempt"
        ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

        -- Set updatedAt = createdAt for existing rows
        UPDATE "public"."Attempt" SET "updatedAt" = "createdAt";
    END IF;
END $$;

-- AlterTable: Add updatedAt to podcast_attempts if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'podcast_attempts'
          AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "public"."podcast_attempts"
        ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

        -- Set updatedAt = createdAt for existing rows
        UPDATE "public"."podcast_attempts" SET "updatedAt" = "createdAt";
    END IF;
END $$;

-- Drop defaults (Prisma @updatedAt manages updates, not DB)
ALTER TABLE "public"."Attempt" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "public"."podcast_attempts" ALTER COLUMN "updatedAt" DROP DEFAULT;
