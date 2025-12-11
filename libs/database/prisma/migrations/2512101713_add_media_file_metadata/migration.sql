-- AlterTable: Add updatedAt column
ALTER TABLE "MediaFile" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
-- Set default for existing rows
UPDATE "MediaFile" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
-- Set NOT NULL constraint
ALTER TABLE "MediaFile" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "MediaFile" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MediaFile" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "MediaFile" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- AlterTable
ALTER TABLE "MediaFile" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- AlterTable
ALTER TABLE "MediaFile" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- AlterTable
ALTER TABLE "MediaFile" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

-- AlterTable
ALTER TABLE "MediaFile" ADD COLUMN IF NOT EXISTS "context" JSONB;

-- AlterTable: Add pgvector embedding column
ALTER TABLE "MediaFile" ADD COLUMN IF NOT EXISTS "embedding_vector" vector(768);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MediaFile_usageCount_idx" ON "MediaFile"("usageCount");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MediaFile_source_sourceId_idx" ON "MediaFile"("source", "sourceId");

-- CreateIndex: GIN index for tags array
CREATE INDEX IF NOT EXISTS "MediaFile_tags_idx" ON "MediaFile" USING GIN("tags");

-- CreateIndex: pgvector index for semantic search
CREATE INDEX IF NOT EXISTS "media_file_embedding_vector_idx" ON "MediaFile"
USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 100);
