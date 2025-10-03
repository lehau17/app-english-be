# RAG Model Indexing - Quick Start

## TL;DR

The RAG system now indexes courses, lessons, activities, and vocabulary with **AUTO-REINDEX** support. Users can ask the AI agent about learning content, and the knowledge base automatically updates when data changes.

## Quick Setup (First Time)

```bash
# 1. Make sure database is ready (with pgvector recommended)
# 2. Index your existing data
GEMINI_API_KEY=your_api_key npm run reindex:models
# 3. Auto-reindex is enabled by default when API starts
```

## 🔄 Auto-Reindex Feature

**NEW**: The system now automatically updates the knowledge base when you:

- Create/update/delete courses
- Create/update/delete lessons
- Create/update/delete activities
- Create/update/delete vocabulary

No manual reindexing needed! 🎉

## Periodic Re-indexing

```bash
# After adding new courses/lessons/vocab, re-run:
GEMINI_API_KEY=your_api_key npm run reindex:models

# Or use the API:
curl -X POST http://localhost:3000/agent/knowledge/reindex \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Auto-Reindex Management

| Endpoint | What it does |
|----------|-------------|
| `GET /agent/knowledge/auto-reindex/status` | Check auto-reindex status & stats |
| `POST /agent/knowledge/auto-reindex/trigger?model=course&id=123` | Manual trigger for specific entity |

## Manual Indexing (Legacy)

| Endpoint | What it does |
|----------|-------------|
| `POST /agent/knowledge/reindex` | Index everything |
| `POST /agent/knowledge/index-courses` | Index courses only |
| `POST /agent/knowledge/index-lessons` | Index lessons only |
| `POST /agent/knowledge/index-vocabulary` | Index vocabulary only |
| `POST /agent/knowledge/index-activities` | Index activities only |

## Example User Questions

Now users can ask:

- "Khóa học nào về tiếng Anh cơ bản?"
- "Bài học nào trong khóa English 101?"
- "Từ vựng về chủ đề shopping?"
- "Hoạt động nào giúp luyện nghe?"

## Files Changed

- `apps/client-api/src/domains/agent/service/auto-reindex.service.ts` - **NEW: Auto-reindex logic**
- `apps/client-api/src/domains/agent/service/rag.service.ts` - Core indexing logic
- `apps/client-api/src/domains/agent/controller/private-agent.controller.ts` - API endpoints
- `apps/client-api/src/domains/agent/agent.module.ts` - Module configuration
- `scripts/index-model-data.ts` - CLI indexing script

## Limits

- Vocabulary: Top 1000 by frequency
- Activities: 500 max
- (Can be adjusted in RagService if needed)

## Troubleshooting

**"GEMINI_API_KEY not set"**
→ Set the environment variable

**"Cannot connect to database"**
→ Check DATABASE_URL in .env

**Slow searches**
→ Enable pgvector extension for better performance

**Auto-reindex not working**
→ Check API logs for AutoReindexService initialization
→ Verify GEMINI_API_KEY is set for embedding generation

### Manual trigger auto-reindex

```bash
# Check status
curl -X GET http://localhost:3000/agent/knowledge/auto-reindex/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Manually trigger for specific entity
curl -X POST "http://localhost:3000/agent/knowledge/auto-reindex/trigger?model=course&id=course-id&action=update" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Learn More

See full documentation: `docs/RAG_MODEL_INDEXING.md`
