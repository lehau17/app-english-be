-- AlterTable
ALTER TABLE "public"."knowledge_documents" ADD COLUMN     "chunk_index" INTEGER,
ADD COLUMN     "is_chunk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_id" TEXT,
ADD COLUMN     "total_chunks" INTEGER DEFAULT 0;

-- CreateIndex
CREATE INDEX "knowledge_documents_parent_id_idx" ON "public"."knowledge_documents"("parent_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_is_chunk_idx" ON "public"."knowledge_documents"("is_chunk");

-- CreateIndex
CREATE INDEX "knowledge_documents_parent_id_chunk_index_idx" ON "public"."knowledge_documents"("parent_id", "chunk_index");

-- AddForeignKey
ALTER TABLE "public"."knowledge_documents" ADD CONSTRAINT "knowledge_documents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
