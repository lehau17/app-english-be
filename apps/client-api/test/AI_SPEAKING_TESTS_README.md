# AI Speaking Module Unit Tests

This document describes the unit tests for the AI Speaking module.

## Overview

Two comprehensive test suites have been created for the AI Speaking module:

1. **AiSpeakingService Tests** (`ai-speaking.service.spec.ts`)
2. **ConversationDesignerService Tests** (`conversation-designer.service.spec.ts`)

## Test Coverage Summary

### AiSpeakingService (13 tests)

#### startSession
- ✓ Creates session with all required entities (session, turn, segments)
- ✓ Generates conversationId automatically when not provided
- ✓ Calls conversation designer with correct parameters
- ✓ Creates system and AI turn segments
- ✓ Updates session state to ai_speaking
- ✓ Triggers realtime streaming

#### getSession
- ✓ Returns session when user owns it
- ✓ Throws NotFoundException when session doesn't exist
- ✓ Throws ForbiddenException when user doesn't own session

#### listSessions
- ✓ Returns list of user sessions with proper filtering
- ✓ Passes pagination options correctly

#### finalizeSession
- ✓ Successfully finalizes active session with summary
- ✓ Skips finalization if session already finished/aborted
- ✓ Throws NotFoundException when session doesn't exist

#### listConversations
- ✓ Returns grouped conversations with latest session and count

#### getConversation
- ✓ Returns all sessions in a conversation
- ✓ Throws NotFoundException when conversation doesn't exist

### ConversationDesignerService (14 tests)

#### buildOpeningPrompt
- ✓ Generates correct prompt structure for beginner level
- ✓ Handles all 6 difficulty levels (beginner, elementary, intermediate, upper_intermediate, advanced, expert)
- ✓ Uses default topic "your daily life" when not provided
- ✓ Includes 3 appropriate follow-up suggestions
- ✓ Includes difficulty-specific hints in metadata for all levels
- ✓ Creates valid prompt format with question
- ✓ Returns consistent structure across different topics
- ✓ Generates unique suggestions referencing the topic
- ✓ Handles special characters in topic names
- ✓ Handles empty string topics by using default
- ✓ Maintains version number "1.0.0"

## Running the Tests

### Run all AI Speaking tests
```bash
npm test -- --testPathPattern="(ai-speaking|conversation-designer)"
```

### Run individual test suites
```bash
# AiSpeakingService tests
npm test -- --testPathPattern="ai-speaking.service.spec.ts"

# ConversationDesignerService tests
npm test -- --testPathPattern="conversation-designer.service.spec.ts"
```

### Run with verbose output
```bash
npm test -- --testPathPattern="(ai-speaking|conversation-designer)" --verbose
```

## Test Architecture

### Mocking Strategy

The tests use a minimal mocking approach with the following key patterns:

1. **Dependency Mocking**: All service dependencies are mocked using `jest.fn()` to avoid actual database/external service calls
2. **Environment Setup**: Required environment variables (`KAFKA_BROKERS`, `DATABASE_URL`) are set before imports to avoid initialization errors
3. **Mock Data**: Complete mock objects matching Prisma schemas are used to simulate realistic data flows

### Key Mock Objects

```typescript
const makeMocks = () => {
  const prisma: any = {
    $transaction: jest.fn((callback: any) => callback(prisma)),
    // ... other Prisma methods
  };

  const repository: any = {
    findSessionById: jest.fn(),
    createSession: jest.fn(),
    // ... other repository methods
  };

  const coordinator: any = {
    summarizeSession: jest.fn(),
  };

  const realtimeService: any = {
    streamAiTurn: jest.fn(),
  };

  const conversationDesigner: any = {
    buildOpeningPrompt: jest.fn(),
  };

  return { prisma, repository, coordinator, realtimeService, conversationDesigner };
};
```

## Test Results

All tests pass successfully:

```
Test Suites: 2 passed, 2 total
Tests:       27 passed, 27 total
Snapshots:   0 total
Time:        ~2s
```

## Coverage Areas

### Fully Covered
- Session lifecycle (start, get, list, finalize)
- Conversation management (list, get)
- Authorization checks (ownership validation)
- Error handling (NotFoundException, ForbiddenException)
- Conversation prompt generation
- Difficulty level handling
- Default value handling

### Integration Points Verified
- Transaction handling
- Repository interactions
- Coordinator service calls
- Realtime service streaming triggers
- Presenter/DTO transformations

## Notes

- Tests are designed to be isolated and can run in any order
- No actual database or external services are required
- Environment variables must be set before running tests
- Mock data follows the Prisma schema structure from `@prisma/client`
