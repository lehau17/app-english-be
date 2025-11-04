-- Manual migration to add video support to podcasts
-- Run this SQL directly on database

-- Step 1: Make audioUrl nullable
ALTER TABLE "public"."podcasts"
ALTER COLUMN "audioUrl" DROP NOT NULL;

-- Step 2: Add videoUrl column
ALTER TABLE "public"."podcasts"
ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;

-- Step 3: Add mediaType column with default value
ALTER TABLE "public"."podcasts"
ADD COLUMN IF NOT EXISTS "mediaType" TEXT NOT NULL DEFAULT 'audio';

-- Step 4: Set existing records to have audio mediaType
UPDATE "public"."podcasts"
SET "mediaType" = 'audio'
WHERE "mediaType" IS NULL OR "mediaType" = '';

-- Verify changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'podcasts'
AND column_name IN ('audioUrl', 'videoUrl', 'mediaType')
ORDER BY column_name;

