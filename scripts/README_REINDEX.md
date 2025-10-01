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

4) Index model data into knowledge base (NEW)

   - The RAG system now supports indexing existing model data (courses, lessons, activities, vocabulary)
   - This allows users to search and ask questions about your content through the AI agent

   To index all models:
     GEMINI_API_KEY=your_key npm run reindex:models

   To index specific models:
     GEMINI_API_KEY=your_key MODEL=courses npm run reindex:models
     GEMINI_API_KEY=your_key MODEL=lessons npm run reindex:models
     GEMINI_API_KEY=your_key MODEL=vocabulary npm run reindex:models
     GEMINI_API_KEY=your_key MODEL=activities npm run reindex:models

   Or use the API endpoints (requires authentication):
     POST /agent/knowledge/reindex           - Index all models
     POST /agent/knowledge/index-courses     - Index courses only
     POST /agent/knowledge/index-lessons     - Index lessons only
     POST /agent/knowledge/index-vocabulary  - Index vocabulary only
     POST /agent/knowledge/index-activities  - Index activities only

5) Deploy code changes

   - The repository already includes updates to `RagService` to write `embedding_vector` on add and to query ANN.
   - After migration and running reindex, test `searchKnowledge` to ensure results and performance.

6) Rollback plan

   - If anything fails, you can drop the column:
     ALTER TABLE knowledge_document DROP COLUMN IF EXISTS embedding_vector;

Questions / notes
- Ensure Prisma DB user has permission to CREATE EXTENSION and run UPDATE.
- Adjust vector dimension to the exact embedding length returned by `text-embedding-004`.
- Model data indexing limits: vocabulary (top 1000 by frequency), activities (500 total)
- Re-run indexing periodically to keep knowledge base in sync with model changes

