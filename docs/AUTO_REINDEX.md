# Auto-Reindex Feature Documentation

## 🎯 Overview

The Auto-Reindex feature automatically updates the RAG knowledge base whenever you create, update, or delete courses, lessons, activities, or vocabulary. No more manual reindexing required!

## 🔧 How It Works

### Prisma Middleware
- Intercepts all database operations for watched models
- Emits events when create/update/delete operations occur
- Non-blocking - doesn't slow down your API responses

### Event-Driven Processing
- Uses Node.js EventEmitter for async processing
- Automatically formats content for each model type
- Updates both JSON embedding and pgvector columns

### Supported Models
- ✅ **Courses** - Title, description, instructor, difficulty, etc.
- ✅ **Lessons** - Title, course relationship, objectives, etc.
- ✅ **Activities** - Title, type, instructions, content summary
- ✅ **Vocabulary** - Word, definition, pronunciation, examples

## 🚀 Setup

### 1. Environment Variables
Make sure you have `GEMINI_API_KEY` set in your `.env` file:

```bash
GEMINI_API_KEY=your_google_gemini_api_key
```

### 2. Start the API
Auto-reindex is enabled automatically when the API starts:

```bash
npm run start:client-api:dev
```

Look for this log message:
```
✅ Auto-Reindex Service initialized successfully
```

## 📊 Monitoring

### Check Status
```bash
curl -X GET http://localhost:3334/agent/knowledge/auto-reindex/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "success": true,
  "message": "Auto-reindex status retrieved",
  "knowledgeDocuments": 150,
  "sourceEntities": {
    "courses": 12,
    "lessons": 45,
    "activities": 89,
    "vocabulary": 500
  },
  "isAutoReindexEnabled": true
}
```

### Manual Trigger
If needed, you can manually trigger reindexing for specific entities:

```bash
curl -X POST "http://localhost:3334/agent/knowledge/auto-reindex/trigger?model=course&id=course-123&action=update" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🧪 Testing

### Automated Test
Run the automated test script:

```bash
npm run test:auto-reindex
```

This will:
1. Check auto-reindex status
2. Create a test course
3. Verify it appears in knowledge base
4. Update the course
5. Verify updates are reflected
6. Delete the course
7. Verify removal from knowledge base

### Manual Testing

1. **Create a new course** via API or CMS
2. **Wait 2-3 seconds** for processing
3. **Ask the AI agent** about your course:
   ```bash
   curl -X POST http://localhost:3334/agent/chat \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"message": "Tell me about [Your Course Name]"}'
   ```

## 🐛 Troubleshooting

### Auto-reindex not working
1. **Check API logs** for initialization message
2. **Verify GEMINI_API_KEY** is set and valid
3. **Check database connection** - auto-reindex needs working DB
4. **Look for error logs** with `AutoReindexService` prefix

### Performance Issues
- Auto-reindex processes asynchronously - no impact on API response time
- If you have many simultaneous operations, consider batch processing
- Monitor memory usage if processing large content

### Knowledge Base Out of Sync
If you suspect the knowledge base is out of sync:

1. **Check status endpoint** to see entity counts
2. **Run manual reindex** for specific entities
3. **Full reindex** as last resort:
   ```bash
   GEMINI_API_KEY=your_key npm run reindex:models
   ```

## 📝 Logs

Watch for these log messages:

### Success
```
📚 Auto-reindexing course (create) - ID: course-123
✅ Created knowledge document: course_course-123
```

### Errors
```
❌ Failed to auto-reindex course course-123: GEMINI_API_KEY not set
❌ Failed to upsert knowledge document course_course-123: Database connection error
```

## 🔄 Migration from Manual Reindex

If you were previously using manual reindexing:

1. **Remove cron jobs** or scheduled reindex scripts
2. **Keep the manual endpoints** for backup/emergency use
3. **Monitor the auto-reindex** for the first few days
4. **Run initial full reindex** to ensure knowledge base is current:
   ```bash
   GEMINI_API_KEY=your_key npm run reindex:models
   ```

## ⚙️ Configuration

### Disable Auto-Reindex
If you need to disable auto-reindex temporarily, you can modify the `AutoReindexService`:

```typescript
// In auto-reindex.service.ts
async onModuleInit() {
  if (process.env.DISABLE_AUTO_REINDEX === 'true') {
    this.logger.log('Auto-reindex disabled by environment variable');
    return;
  }
  // ... rest of initialization
}
```

Then set in your `.env`:
```bash
DISABLE_AUTO_REINDEX=true
```

### Adjust Processing Delay
To reduce load, you can add delays between operations:

```typescript
// In handleReindexEvent method
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
```

## 🚨 Important Notes

1. **GEMINI_API_KEY required** - Auto-reindex will fail without it
2. **Async processing** - Changes may take 1-3 seconds to appear in knowledge base
3. **No transaction rollback** - If reindexing fails, the original operation still succeeds
4. **Delete operations** - Automatically remove entities from knowledge base
5. **Batch operations** - Each entity in a batch triggers individual reindex events

## 🎉 Benefits

- ✅ **Always up-to-date** knowledge base
- ✅ **Zero maintenance** - no manual reindexing needed
- ✅ **Real-time accuracy** - AI responses always reflect latest data
- ✅ **Performance** - async processing doesn't slow down API
- ✅ **Reliability** - handles errors gracefully with logging
