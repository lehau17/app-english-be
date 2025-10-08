-- =====================================================
-- Full-Text Search Setup for Knowledge Documents
-- =====================================================
-- This migration adds PostgreSQL Full-Text Search (FTS)
-- capabilities to enable Hybrid Search (Semantic + Keyword)
-- =====================================================

-- Step 1: Add tsvector column for full-text search
-- This column stores tokenized, stemmed version of content
ALTER TABLE "knowledge_documents"
ADD COLUMN "content_search" tsvector;

-- Step 2: Create GIN index for fast full-text queries
-- GIN (Generalized Inverted Index) is optimal for tsvector
CREATE INDEX "knowledge_documents_content_search_idx"
ON "knowledge_documents" USING GIN ("content_search");

-- Step 3: Create function to automatically update content_search
-- Combines title + content for better search coverage
CREATE OR REPLACE FUNCTION public.update_knowledge_document_search()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate tsvector from title (weight A) + content (weight B)
  -- Weight A gives higher ranking to title matches
  NEW.content_search :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');

  RETURN NEW;
END;
$$;

-- Step 4: Create trigger to auto-update on INSERT/UPDATE
CREATE TRIGGER knowledge_document_search_update
BEFORE INSERT OR UPDATE ON "knowledge_documents"
FOR EACH ROW
EXECUTE FUNCTION public.update_knowledge_document_search();

-- Step 5: Populate content_search for existing documents
-- This runs once to backfill all existing records
UPDATE "knowledge_documents"
SET content_search =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(content, '')), 'B');
