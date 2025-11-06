# Agent Chat History - Manual Testing Guide

> Last updated: 2025-11-05 — Tóm tắt: Hướng dẫn kiểm thử thủ công cho tính năng lưu lịch sử chat của Agent.

This guide provides steps to manually test the agent chat history feature.

## Prerequisites

1. Database is running with migrations applied:
   ```bash
   npm run prisma:migrate
   ```

2. Server is running:
   ```bash
   npm run start:client-api:dev
   ```

3. You have a valid JWT token for authentication

## Test Scenarios

### 1. Start a New Conversation

**Request:**
```bash
curl -X POST http://localhost:3334/agent/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What beginner courses are available?"
  }'
```

**Expected Response:**
- Status: 200
- Response should contain:
  - `response`: AI's answer
  - `conversationId`: UUID of new conversation
  - `toolsUsed`: Array of tools used
  - `processingTime`: Processing time in ms

**Verification:**
- Note the `conversationId` for next tests
- Check database: `SELECT * FROM "AgentConversation" ORDER BY "createdAt" DESC LIMIT 1;`
- Check messages: `SELECT * FROM "AgentMessage" WHERE "conversationId" = 'YOUR_CONVERSATION_ID';`

### 2. Continue Existing Conversation

**Request:**
```bash
curl -X POST http://localhost:3334/agent/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Which one would you recommend for complete beginners?",
    "conversationId": "CONVERSATION_ID_FROM_STEP_1"
  }'
```

**Expected Response:**
- Status: 200
- Response should reference previous context
- Same `conversationId` returned

**Verification:**
- Check messages table has new user and assistant messages
- Agent should provide context-aware response based on previous messages

### 3. List User Conversations

**Request:**
```bash
curl -X GET "http://localhost:3334/agent/conversations?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
- Status: 200
- Array of conversations for the authenticated user
- Each conversation has: id, userId, title, createdAt, updatedAt

### 4. Get Conversation Details

**Request:**
```bash
curl -X GET "http://localhost:3334/agent/conversations/:id?id=CONVERSATION_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
- Status: 200
- Conversation object with `messages` array
- Messages should be in chronological order
- Each message has: id, role, content, createdAt

### 5. Delete Conversation

**Request:**
```bash
curl -X POST "http://localhost:3334/agent/conversations/:id/delete?id=CONVERSATION_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
- Status: 200
- `{ "success": true, "message": "Conversation deleted successfully" }`

**Verification:**
- Check database: Conversation and all its messages should be deleted
- Trying to continue deleted conversation should create a new one

### 6. Test Chat History Context

Create a multi-turn conversation to verify context:

**Turn 1:**
```json
{
  "message": "What is the price of the Basic English course?"
}
```

**Turn 2:** (using conversationId from Turn 1)
```json
{
  "message": "Is that per month or one-time?",
  "conversationId": "..."
}
```

**Turn 3:** (using same conversationId)
```json
{
  "message": "How long is the course?",
  "conversationId": "..."
}
```

**Expected Behavior:**
- Turn 2 should understand "that" refers to the price from Turn 1
- Turn 3 should understand "the course" refers to Basic English course
- Responses should be coherent and contextual

### 7. Test Invalid Conversation Access

Try to access another user's conversation:

**Request:**
```bash
curl -X GET "http://localhost:3334/agent/conversations/:id?id=OTHER_USER_CONVERSATION_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
- Status: 500 (will be improved with proper error handling)
- Error message: "Conversation not found or access denied"

### 8. Test With Empty conversationId

**Request:**
```json
{
  "message": "What courses do you have?",
  "conversationId": "non-existent-uuid"
}
```

**Expected Behavior:**
- Should create a new conversation (invalid ID treated as new conversation)
- Should return new conversationId

## Database Queries for Verification

### View all conversations for a user:
```sql
SELECT * FROM "AgentConversation"
WHERE "userId" = 'USER_ID'
ORDER BY "updatedAt" DESC;
```

### View all messages in a conversation:
```sql
SELECT * FROM "AgentMessage"
WHERE "conversationId" = 'CONVERSATION_ID'
ORDER BY "createdAt" ASC;
```

### Count messages per conversation:
```sql
SELECT
  c.id,
  c.title,
  COUNT(m.id) as message_count
FROM "AgentConversation" c
LEFT JOIN "AgentMessage" m ON m."conversationId" = c.id
GROUP BY c.id, c.title
ORDER BY c."updatedAt" DESC;
```

### View conversation with messages:
```sql
SELECT
  c.id as conversation_id,
  c.title,
  m.role,
  m.content,
  m."createdAt"
FROM "AgentConversation" c
LEFT JOIN "AgentMessage" m ON m."conversationId" = c.id
WHERE c.id = 'CONVERSATION_ID'
ORDER BY m."createdAt" ASC;
```

## Testing the RAG Context

To verify that chat history is being passed to RAG:

1. Start a conversation asking about a specific topic
2. In subsequent messages, use pronouns or references that require context
3. Check the agent's response to see if it maintains context
4. Look at the service logs to verify history is being formatted and passed

Example conversation flow:
- User: "Tell me about the Advanced Grammar course"
- AI: "The Advanced Grammar course covers..."
- User: "How many lessons does it have?" (should understand "it" = Advanced Grammar)
- AI: Should respond with info about Advanced Grammar course specifically

## Common Issues

### Issue: "Conversation not found"
- **Cause:** ConversationId doesn't exist or belongs to another user
- **Solution:** Verify the conversationId is correct and belongs to the authenticated user

### Issue: Agent doesn't remember context
- **Cause:** ConversationId not being passed in subsequent requests
- **Solution:** Ensure you're including the conversationId in follow-up messages

### Issue: Database errors
- **Cause:** Migration not run
- **Solution:** Run `npm run prisma:migrate`

## Performance Testing

Test with multiple concurrent conversations:

```bash
# Create 10 conversations in parallel
for i in {1..10}; do
  curl -X POST http://localhost:3334/agent/chat \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"Test message $i\"}" &
done
wait
```

Verify:
- All conversations are created
- No race conditions or duplicate conversations
- Performance is acceptable

## Cleanup

After testing, clean up test data:

```sql
DELETE FROM "AgentMessage" WHERE "conversationId" IN (
  SELECT id FROM "AgentConversation" WHERE "userId" = 'TEST_USER_ID'
);
DELETE FROM "AgentConversation" WHERE "userId" = 'TEST_USER_ID';
```
