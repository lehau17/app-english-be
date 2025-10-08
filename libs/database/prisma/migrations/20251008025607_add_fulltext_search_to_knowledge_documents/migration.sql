-- Check if column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_documents' AND column_name = 'content_search'
  ) THEN
    ALTER TABLE "knowledge_documents"
    ADD COLUMN "content_search" tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
    ) STORED;
  END IF;
END $$;

-- Create GIN index for fast full-text search (if not exists)
CREATE INDEX IF NOT EXISTS "knowledge_documents_content_search_idx"
ON "knowledge_documents" USING GIN ("content_search");

-- Create trigger function to notify when knowledge documents change
CREATE OR REPLACE FUNCTION public.notify_knowledge_document_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'knowledge_document_changed',
    json_build_object(
      'operation', TG_OP,
      'id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      'documentType', CASE WHEN TG_OP = 'DELETE' THEN OLD."documentType" ELSE NEW."documentType" END
    )::text
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS knowledge_document_notify ON "public"."knowledge_documents";

-- Create trigger for knowledge document changes
CREATE TRIGGER knowledge_document_notify
AFTER INSERT OR UPDATE OR DELETE ON "public"."knowledge_documents"
FOR EACH ROW EXECUTE FUNCTION public.notify_knowledge_document_change();
