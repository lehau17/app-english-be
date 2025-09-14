Migration steps to enable pgvector and reindex embeddings

1) Confirm embedding dimension
   - The project uses `GeminiService.generateEmbedding` which currently requests `text-embedding-004`.
   - Execute a quick embedding call (or check `GeminiService`) to determine the vector length (e.g., 768).

2) Apply DB migration (Postgres):

   -- enable pgvector
   CREATE EXTENSION IF NOT EXISTS vector;

   -- add vector column (replace 768 with actual dim)
   ALTER TABLE knowledge_document
     ADD COLUMN embedding_vector vector(768);

   -- create index (example using ivfflat):
   CREATE INDEX ON knowledge_document USING ivfflat (embedding_vector vector_l2_ops) WITH (lists = 100);

   Note: If your pgvector supports HNSW and you prefer it, adjust accordingly.

3) Build and run the reindex script

   - install deps in the English-learning package (ts-node, node-fetch if needed)

     npm install --prefix english-learning ts-node node-fetch @prisma/client

   - run the script (set GEMINI_API_KEY):

     cd english-learning
     GEMINI_API_KEY=your_key ts-node scripts/reindex-embeddings.ts

   The script will iterate documents and populate `embedding_vector`.

4) Deploy code changes

   - The repository already includes updates to `RagService` to write `embedding_vector` on add and to query ANN.
   - After migration and running reindex, test `searchKnowledge` to ensure results and performance.

5) Rollback plan

   - If anything fails, you can drop the column:
     ALTER TABLE knowledge_document DROP COLUMN IF EXISTS embedding_vector;

Questions / notes
- Ensure Prisma DB user has permission to CREATE EXTENSION and run UPDATE.
- Adjust vector dimension to the exact embedding length returned by `text-embedding-004`.
