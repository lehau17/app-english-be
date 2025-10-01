# RAG Model Data Indexing

## Overview

The RAG (Retrieval Augmented Generation) system has been extended to index and search data from existing application models, not just manually added admin documents. This significantly enhances the AI agent's ability to answer questions about courses, lessons, vocabulary, and activities.

## What Changed

### Before
- RAG only searched through `knowledgeDocument` table
- Only manually added admin documents (policies, regulations, handbooks)
- Limited to ~3 sample documents on startup

### After
- RAG searches across all indexed content including:
  - **Courses**: All course information with instructor details
  - **Lessons**: All lessons with course context
  - **Vocabulary**: Top 1000 vocabulary words by frequency
  - **Activities**: Up to 500 activities with lesson/course context
  - **Admin documents**: Original manual documents still work

## Features

### 1. Automatic Indexing Methods

The `RagService` now includes methods to index each model type:

```typescript
// Index all courses
await ragService.indexCourses();

// Index all lessons
await ragService.indexLessons();

// Index vocabulary
await ragService.indexVocabulary();

// Index activities
await ragService.indexActivities();

// Index everything at once
await ragService.reindexAllModels();
```

### 2. REST API Endpoints

Five new endpoints available at `/agent/knowledge/*`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/knowledge/reindex` | POST | Index all model data |
| `/agent/knowledge/index-courses` | POST | Index courses only |
| `/agent/knowledge/index-lessons` | POST | Index lessons only |
| `/agent/knowledge/index-vocabulary` | POST | Index vocabulary only |
| `/agent/knowledge/index-activities` | POST | Index activities only |

**Example Response:**
```json
{
  "success": true,
  "message": "Course indexing completed",
  "indexed": 45,
  "errors": 0
}
```

### 3. CLI Script

Bulk indexing script for initial setup or periodic re-indexing:

```bash
# Index all models
GEMINI_API_KEY=your_key npm run reindex:models

# Index specific model
GEMINI_API_KEY=your_key MODEL=courses npm run reindex:models
GEMINI_API_KEY=your_key MODEL=lessons npm run reindex:models
GEMINI_API_KEY=your_key MODEL=vocabulary npm run reindex:models
GEMINI_API_KEY=your_key MODEL=activities npm run reindex:models
```

## How It Works

### Data Transformation

Each model is transformed into a searchable text document:

**Course Example:**
```
Khóa học: English for Beginners
Mô tả: Learn basic English grammar and vocabulary
Độ khó: beginner
Giáo viên: John Doe
Thời lượng ước tính: 20 giờ
Giá: 0 VND
Tags: english, beginner, grammar
...
```

**Vocabulary Example:**
```
Từ vựng: hello
Định nghĩa: A greeting
Phát âm: həˈloʊ
Độ khó: beginner
Danh mục: greetings
...
```

### Indexing Flow

1. **Fetch data** from model table (Course, Lesson, etc.)
2. **Format content** using helper methods
3. **Generate embedding** using Gemini API
4. **Store in knowledge_documents** table with:
   - `title`: Model name/title
   - `content`: Formatted text
   - `documentType`: 'course', 'lesson', 'vocabulary', 'activity'
   - `source`: Unique ID like `course_abc123`
   - `embedding`: JSON array of embedding vector
   - `embedding_vector`: pgvector column (if available)

### Search Enhancement

- Search now returns up to **5 documents** (increased from 3)
- Results include all document types (courses, lessons, vocab, activities, admin docs)
- Agent prioritizes `knowledge_search` for learning content questions

## Usage Examples

### API Usage

```bash
# Reindex all models after adding new courses
curl -X POST http://localhost:3000/agent/knowledge/reindex \
  -H "Authorization: Bearer YOUR_TOKEN"

# Index only new vocabulary
curl -X POST http://localhost:3000/agent/knowledge/index-vocabulary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### User Questions (via Agent)

The AI agent can now answer questions like:

- "Khóa học nào về tiếng Anh cơ bản?" → Searches courses
- "Bài học nào trong khóa English 101?" → Searches lessons
- "Từ vựng về chủ đề shopping là gì?" → Searches vocabulary
- "Hoạt động nào giúp luyện nghe?" → Searches activities
- "Điều kiện tốt nghiệp là gì?" → Searches admin documents

## Configuration

### Limits

To prevent excessive API calls:
- **Vocabulary**: Limited to top 1000 by frequency
- **Activities**: Limited to 500 total

These can be adjusted in `RagService` methods if needed.

### Re-indexing

Indexed data is **not automatically updated** when models change. You should:

1. **Manual re-index** when adding/updating many items:
   ```bash
   npm run reindex:models
   ```

2. **API re-index** for specific updates:
   ```bash
   curl -X POST /agent/knowledge/index-courses
   ```

3. **Scheduled re-index** (recommended):
   - Add a cron job to re-index weekly/monthly
   - Example: Use background-worker to schedule indexing

## Performance Considerations

### pgvector (Recommended)

For best performance, enable pgvector extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE knowledge_documents ADD COLUMN embedding_vector vector(768);
CREATE INDEX ON knowledge_documents USING ivfflat (embedding_vector vector_l2_ops);
```

See `scripts/README_REINDEX.md` for full migration steps.

### Fallback Mode

Without pgvector, the system:
- Falls back to in-memory cosine similarity
- Still works but slower with many documents
- Limited to ~1000 documents for reasonable performance

## Troubleshooting

### "Empty embedding" errors
- Check that GEMINI_API_KEY is valid
- Verify model content is not empty
- Check API rate limits

### "Cannot connect to database"
- Ensure PostgreSQL is running
- Verify DATABASE_URL in .env
- Check database permissions

### High memory usage
- Reduce vocabulary/activity limits
- Enable pgvector for ANN queries
- Index in smaller batches

## Future Enhancements

Potential improvements:
- [ ] Auto-indexing on model create/update (via hooks or events)
- [ ] Incremental indexing (only changed records)
- [ ] Support for more models (assignments, tests, etc.)
- [ ] Multi-language support for better non-English content
- [ ] Relevance scoring tuning
- [ ] Document expiry/versioning

## See Also

- `scripts/README_REINDEX.md` - pgvector setup and reindexing
- `apps/client-api/src/domains/agent/service/rag.service.ts` - Implementation
- `apps/client-api/src/domains/agent/tools/rag.tool.ts` - Agent integration
