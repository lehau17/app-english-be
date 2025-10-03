# Agent Chat History Feature

## Overview

This feature enables the AI agent to maintain conversation history with users, providing context-aware responses by passing previous messages to the RAG (Retrieval-Augmented Generation) system.

## Database Schema

### AgentConversation
Stores conversation threads between users and the AI agent.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to User |
| title | String | Optional conversation title (auto-generated from first message) |
| metadata | JSON | Additional metadata |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

### AgentMessage
Stores individual messages within conversations.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| conversationId | UUID | Foreign key to AgentConversation |
| role | String | Either 'user' or 'assistant' |
| content | Text | Message content |
| metadata | JSON | Additional metadata (tools used, reasoning, etc.) |
| createdAt | DateTime | Creation timestamp |

## API Endpoints

### POST /agent/chat
Send a message to the AI agent.

**Request:**
```json
{
  "message": "What courses are available?",
  "conversationId": "optional-uuid-to-continue-conversation"
}
```

**Response:**
```json
{
  "response": "Here are the available courses...",
  "conversationId": "uuid-of-conversation",
  "confidence": 0.85,
  "sources": ["Knowledge Base", "Database"],
  "toolsUsed": ["knowledge_search", "call_api"],
  "reasoning": "Step 1: knowledge_search...",
  "processingTime": 1234
}
```

### GET /agent/conversations
List user's conversations with pagination.

**Query Parameters:**
- `limit` (optional, default: 20): Number of conversations to return
- `offset` (optional, default: 0): Number of conversations to skip

**Response:**
```json
[
  {
    "id": "conversation-uuid",
    "userId": "user-uuid",
    "title": "What courses are available?",
    "createdAt": "2024-10-03T12:00:00Z",
    "updatedAt": "2024-10-03T12:05:00Z"
  }
]
```

### GET /agent/conversations/:id
Get conversation details with all messages.

**Query Parameters:**
- `id`: Conversation ID

**Response:**
```json
{
  "id": "conversation-uuid",
  "userId": "user-uuid",
  "title": "What courses are available?",
  "createdAt": "2024-10-03T12:00:00Z",
  "updatedAt": "2024-10-03T12:05:00Z",
  "messages": [
    {
      "id": "message-uuid-1",
      "role": "user",
      "content": "What courses are available?",
      "createdAt": "2024-10-03T12:00:00Z"
    },
    {
      "id": "message-uuid-2",
      "role": "assistant",
      "content": "Here are the available courses...",
      "createdAt": "2024-10-03T12:00:05Z"
    }
  ]
}
```

### POST /agent/conversations/:id/delete
Delete a conversation and all its messages.

**Query Parameters:**
- `id`: Conversation ID

**Response:**
```json
{
  "success": true,
  "message": "Conversation deleted successfully"
}
```

## Implementation Details

### Chat History Context

When processing a message:
1. If `conversationId` is provided, the system retrieves the last 10 messages from the conversation
2. Messages are formatted into LangChain's chat history format:
   - User messages: `['human', content]`
   - Assistant messages: `['assistant', content]`
3. The formatted history is passed to the LangChain agent for context-aware processing

### New Conversation Creation

If no `conversationId` is provided or the conversation doesn't exist:
1. A new conversation is created
2. The conversation title is automatically set to the first 50 characters of the user's message
3. The new conversation ID is returned in the response

### Message Storage

Both user messages and AI responses are stored:
- User messages: Stored with `role: 'user'`
- AI responses: Stored with `role: 'assistant'` and metadata including:
  - `toolsUsed`: Array of tools used by the agent
  - `reasoning`: Step-by-step reasoning process
  - `processingTime`: Time taken to process the request

### Security

- All endpoints require authentication via JWT token
- Users can only access their own conversations
- Attempting to access another user's conversation returns an error

## Running Migrations

After pulling these changes, run the following commands to set up the database:

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

The migration will create the `AgentConversation` and `AgentMessage` tables with appropriate indexes and foreign keys.

## Usage Example

### Starting a new conversation:
```typescript
const response = await fetch('/agent/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Tell me about beginner English courses'
  })
});

const data = await response.json();
// Save data.conversationId for future messages
```

### Continuing a conversation:
```typescript
const response = await fetch('/agent/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Which one would you recommend?',
    conversationId: savedConversationId
  })
});
```

## Architecture

```
Controller (private-agent.controller.ts)
    ↓
Service (agent.service.ts)
    ↓
    ├─→ Repository (agent-chat.repository.ts) → Database
    └─→ LangChainAgent (langchain-agent.service.ts) → RAG Tools
```

## Future Enhancements

- [ ] Add conversation search functionality
- [ ] Implement conversation sharing between users
- [ ] Add support for conversation export (PDF/JSON)
- [ ] Implement conversation summarization for long histories
- [ ] Add conversation tags/categories
- [ ] Implement conversation archiving
