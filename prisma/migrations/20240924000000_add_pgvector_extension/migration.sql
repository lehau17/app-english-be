-- CreateExtension: Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable: Add vector column to knowledge_documents table
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "embedding_vector" vector(768);

-- CreateIndex: Add index for efficient vector similarity search
CREATE INDEX IF NOT EXISTS "knowledge_documents_embedding_vector_idx"
ON "knowledge_documents"
USING ivfflat ("embedding_vector" vector_cosine_ops)
WITH (lists = 100);

-- CreateIndex: Add partial index for non-null vectors
CREATE INDEX IF NOT EXISTS "knowledge_documents_embedding_vector_non_null_idx"
ON "knowledge_documents" ("embedding_vector")
WHERE "embedding_vector" IS NOT NULL;

-- Comment: Explain the vector column
COMMENT ON COLUMN "knowledge_documents"."embedding_vector" IS 'Vector embedding for semantic search using pgvector (768 dimensions for text-embedding-004)';
