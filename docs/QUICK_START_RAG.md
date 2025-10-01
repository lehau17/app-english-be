# RAG Model Indexing - Quick Start

## TL;DR

The RAG system now indexes courses, lessons, activities, and vocabulary. Users can ask the AI agent about learning content.

## Quick Setup (First Time)

```bash
# 1. Make sure database is ready (with pgvector recommended)
# 2. Index your existing data
GEMINI_API_KEY=your_api_key npm run reindex:models
```

## Periodic Re-indexing

```bash
# After adding new courses/lessons/vocab, re-run:
GEMINI_API_KEY=your_api_key npm run reindex:models

# Or use the API:
curl -X POST http://localhost:3000/agent/knowledge/reindex \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## API Endpoints

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

- `apps/client-api/src/domains/agent/service/rag.service.ts` - Core indexing logic
- `apps/client-api/src/domains/agent/controller/private-agent.controller.ts` - API endpoints
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

## Learn More

See full documentation: `docs/RAG_MODEL_INDEXING.md`
