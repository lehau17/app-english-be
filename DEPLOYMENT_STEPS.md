# Agent Chat History - Deployment Steps

## Required Steps After Merging This PR

### 1. Install Dependencies (if needed)
```bash
npm install
```

### 2. Generate Prisma Client
This regenerates the Prisma client with the new AgentConversation and AgentMessage models.

```bash
npm run prisma:generate
```

Expected output: "Generated Prisma Client"

### 3. Run Database Migration
This creates the AgentConversation and AgentMessage tables in the database.

```bash
npm run prisma:migrate
```

The migration will:
- Create `AgentConversation` table
- Create `AgentMessage` table
- Add indexes for efficient querying
- Add foreign key constraints

Expected output: "Migration applied successfully"

### 4. Verify Migration
Check that the tables were created:

```sql
-- Connect to your database and run:
\dt "AgentConversation"
\dt "AgentMessage"

-- Or check the schema:
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('AgentConversation', 'AgentMessage');
```

### 5. Restart the Server
```bash
# Development
npm run start:client-api:dev

# Production
npm run build:client-api
npm run start:client-api
```

### 6. Test the Feature

#### Quick Test:
```bash
# Replace YOUR_JWT_TOKEN with a valid JWT token
export JWT_TOKEN="your-jwt-token-here"

# Test 1: Send a message (creates new conversation)
curl -X POST http://localhost:3334/agent/chat \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What courses are available?"
  }'

# Save the conversationId from the response, then:

# Test 2: Continue the conversation
curl -X POST http://localhost:3334/agent/chat \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Which one would you recommend?",
    "conversationId": "CONVERSATION_ID_FROM_TEST_1"
  }'

# Test 3: List conversations
curl -X GET http://localhost:3334/agent/conversations \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 7. Verify Context is Working

To verify that chat history is being passed to RAG:

1. Start a conversation asking about a specific topic
2. Ask a follow-up question using pronouns (e.g., "it", "that", "this")
3. The AI should understand the reference from previous messages

Example:
- User: "Tell me about the Advanced Grammar course"
- AI: "The Advanced Grammar course covers..."
- User: "How long does it take?" (should understand "it" = Advanced Grammar)
- AI: Should respond with duration of Advanced Grammar specifically

### 8. Monitor Logs

Check server logs to ensure no errors:

```bash
# Look for successful conversation creation:
# "Created conversation with ID: ..."

# Look for chat history being loaded:
# "Loading 10 previous messages for context"

# Check for any errors related to AgentConversation or AgentMessage
```

## Rollback Plan

If you need to rollback:

### Option 1: Revert the Migration
```bash
# This will drop the tables
npm run prisma:migrate reset
```

**WARNING:** This will delete all data in the database!

### Option 2: Manual Rollback
```sql
-- Drop tables manually
DROP TABLE IF EXISTS "AgentMessage" CASCADE;
DROP TABLE IF EXISTS "AgentConversation" CASCADE;
```

Then revert the code changes:
```bash
git revert <commit-hash>
```

## Environment Variables

No new environment variables are required for this feature.

## Database Considerations

### Storage Requirements
- Each conversation: ~200 bytes
- Each message: ~500 bytes + message content length
- Estimate: 100 messages = ~50KB

For 1000 active users with average 50 messages each:
- Total storage: ~25MB

### Performance
- Queries are indexed on:
  - `userId` (for listing conversations)
  - `conversationId` (for loading messages)
  - `createdAt` (for sorting)

### Cleanup Policy
Consider implementing a cleanup policy:
- Archive conversations older than 90 days
- Delete archived conversations after 1 year
- Or allow users to manage their own conversation history

## Monitoring

Monitor these metrics:
- Number of conversations created per day
- Average messages per conversation
- Response time when loading chat history
- Database query performance

## Support

If you encounter issues:

1. Check the logs for specific error messages
2. Verify migration was applied: `SELECT * FROM "AgentConversation" LIMIT 1;`
3. Review documentation:
   - `docs/AGENT_CHAT_HISTORY.md`
   - `docs/AGENT_CHAT_HISTORY_VI.md`
   - `docs/AGENT_CHAT_TESTING.md`
4. Create an issue on GitHub with:
   - Error message
   - Steps to reproduce
   - Server logs

## Success Criteria

The deployment is successful when:

✅ Migration applied without errors  
✅ Server starts without errors  
✅ Can send messages and receive responses  
✅ `conversationId` is returned in responses  
✅ Follow-up messages with `conversationId` use previous context  
✅ Can list conversations via API  
✅ Can view conversation history  
✅ Can delete conversations  
✅ AI responses show awareness of conversation history  

## Timeline

Estimated deployment time: 10-15 minutes

1. Backup database: 2 min
2. Run migration: 1 min
3. Restart server: 1 min
4. Basic testing: 5 min
5. Context verification: 5 min

---

**Note:** Always backup your database before running migrations in production!
